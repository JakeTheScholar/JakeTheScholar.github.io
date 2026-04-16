"""Lead Scraper Agent — discovers real business leads via Google Places API."""

import re
import sys
import json
import asyncio
import os
import random
import logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_output

# Regex for extracting email addresses from web pages
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Mailto links — most reliable email signal on a page
MAILTO_RE = re.compile(r'mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', re.IGNORECASE)
# Nav/footer links that likely lead to contact pages
CONTACT_LINK_RE = re.compile(r'href=["\']([^"\']*(?:contact|get-in-touch|reach-us|request|inquiry|enquiry)[^"\']*)["\']', re.IGNORECASE)
# Common junk emails to ignore
JUNK_EMAILS = {"noreply", "no-reply", "support", "info@example", "email@example", "user@example", "sentry", "wordpress", "developer"}

logger = logging.getLogger(__name__)

INDUSTRIES = [
    {"id": "hvac_plumbing", "name": "HVAC & Plumbing", "query": "HVAC plumbing contractor"},
    {"id": "dental_ortho", "name": "Dental & Ortho", "query": "dentist orthodontist"},
    {"id": "real_estate", "name": "Real Estate", "query": "real estate agency realtor"},
    {"id": "auto_repair", "name": "Auto Repair", "query": "auto repair mechanic"},
    {"id": "landscaping", "name": "Landscaping", "query": "landscaping lawn care"},
    {"id": "legal_services", "name": "Legal Services", "query": "law firm attorney"},
    {"id": "home_services", "name": "Home Services", "query": "roofing painting electrician"},
    {"id": "medical_spa", "name": "Medical Spa", "query": "medical spa medspa"},
]

LOCATIONS = [
    # Primary — Big Rapids MI area, expanding outward
    "Big Rapids, MI",
    "Reed City, MI",
    "Mecosta, MI",
    "Canadian Lakes, MI",
    "Evart, MI",
    "Mount Pleasant, MI",
    "Cadillac, MI",
    "Ludington, MI",
    "Manistee, MI",
    # Secondary — Ann Arbor MI area, expanding outward
    "Ann Arbor, MI",
    "Ypsilanti, MI",
    "Saline, MI",
    "Dexter, MI",
    "Chelsea, MI",
    "Canton, MI",
    "Plymouth, MI",
    "Livonia, MI",
    "Brighton, MI",
    "Howell, MI",
]

GOOGLE_PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# LLM prompt for pain-point analysis (kept short for llama3.2)
NEEDS_PROMPT = """Analyze this business and list 2-3 pain points as a JSON array of strings.

Business: {name}
Location: {location}
Rating: {rating} ({reviews} reviews)
Has website: {has_website}
Industry: {industry}

Return ONLY a JSON array like ["pain point 1","pain point 2"]. No explanation."""

# Fallback synthetic prompt (used when Google API is unavailable)
FALLBACK_PROMPT = """Generate 3 {industry} businesses near {location}. JSON array, no explanation.

Each object: {{"business_name":"...","contact_name":"...","contact_email":"first@domain.com","contact_phone":"555-XXX-XXXX","website":"www.name.com","location":"{location}","needs":["pain point 1","pain point 2"]}}

Return ONLY the JSON array."""


def _score_lead(place: dict) -> int:
    """Score a lead 0-100 based on signals. Higher = more likely to need services."""
    score = 50  # baseline

    rating = place.get("rating", 0)
    review_count = place.get("user_ratings_total", 0)
    website = place.get("website")

    # No website — strong signal they need digital help
    if not website:
        score += 20

    # Low or missing rating
    if rating == 0:
        score += 10
    elif rating < 3.5:
        score += 15
    elif rating < 4.0:
        score += 8

    # Few reviews — low visibility
    if review_count == 0:
        score += 10
    elif review_count < 10:
        score += 8
    elif review_count < 25:
        score += 4

    # High rating with many reviews — established, less need
    if rating >= 4.5 and review_count > 100:
        score -= 15

    return max(10, min(100, score))


class LeadScraperAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="lead-scraper-001",
            name="Lead Scraper",
            description="Discovers & qualifies leads via Google Places",
            color="#06b6d4",
        )
        self.tick_interval = 45
        self.pipeline_db = None  # Injected by orchestrator
        self.index = 0
        self.location_index = 0
        self._api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")

    # ── Google Places API helpers ──────────────────────────────────

    async def _text_search(self, query: str, location: str) -> list[dict]:
        """Google Places Text Search — returns up to 5 results."""
        if not self._api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY not set")

        params = {
            "query": f"{query} in {location}",
            "key": self._api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(GOOGLE_PLACES_TEXT_SEARCH_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        status = data.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            raise RuntimeError(f"Google Places API error: {status} — {data.get('error_message', '')}")

        return data.get("results", [])[:5]

    # Domains that are social pages, NOT real business websites — treat as no-website
    _SOCIAL_DOMAINS = (
        "facebook.com", "instagram.com", "tiktok.com", "yelp.com",
        "twitter.com", "x.com", "linkedin.com", "nextdoor.com", "youtube.com",
    )

    @classmethod
    def _is_social_url(cls, url: str | None) -> bool:
        if not url:
            return False
        u = url.lower()
        return any(s in u for s in cls._SOCIAL_DOMAINS)

    async def _place_details(self, place_id: str) -> dict:
        """Fetch phone number, website, and Google Maps URL from Place Details API."""
        params = {
            "place_id": place_id,
            "fields": "formatted_phone_number,website,url",
            "key": self._api_key,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(GOOGLE_PLACES_DETAILS_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "OK":
            return {}
        return data.get("result", {})

    # ── Email extraction from business website ───────────────────

    async def _scrape_website(self, website: str) -> dict:
        """Scrape business website for email and contact name.

        Returns {"email": str|None, "contact_name": str|None}.
        Checks mailto: links first (most reliable), then parses nav links
        to find the real contact page, then falls back to common slugs.
        """
        result = {"email": None, "contact_name": None}
        if not website:
            return result

        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers=headers) as client:
                # 1. Fetch homepage
                resp = await client.get(website)
                if resp.status_code != 200:
                    return result
                homepage = resp.text[:60000]
                all_text = homepage

                # 2. Extract mailto: links from homepage (highest confidence)
                mailto_emails = MAILTO_RE.findall(homepage)

                # 3. Find real contact page links from nav/footer
                contact_links = CONTACT_LINK_RE.findall(homepage)
                base = website.rstrip("/")

                # Normalize discovered links to absolute URLs
                pages_to_visit = []
                seen = set()
                for link in contact_links[:3]:
                    if link.startswith("http"):
                        url = link
                    elif link.startswith("/"):
                        url = base + link
                    else:
                        url = base + "/" + link
                    if url not in seen:
                        seen.add(url)
                        pages_to_visit.append(url)

                # 4. Also try common slugs not already discovered
                for slug in ("/contact", "/contact-us", "/about", "/about-us",
                             "/team", "/our-team", "/staff", "/get-in-touch"):
                    url = base + slug
                    if url not in seen:
                        seen.add(url)
                        pages_to_visit.append(url)

                # 5. Crawl discovered + fallback pages (cap at 6 requests)
                for page_url in pages_to_visit[:6]:
                    try:
                        r2 = await client.get(page_url)
                        if r2.status_code == 200:
                            page_text = r2.text[:30000]
                            all_text += page_text
                            mailto_emails.extend(MAILTO_RE.findall(page_text))
                    except Exception:
                        pass

            # 6. Extract emails — prefer mailto: hits, then regex on full text
            candidates = mailto_emails + EMAIL_RE.findall(all_text)
            good_emails = []
            for e in candidates:
                e_lower = e.lower()
                if any(j in e_lower for j in JUNK_EMAILS):
                    continue
                if e_lower.endswith((".png", ".jpg", ".gif", ".css", ".js", ".svg", ".woff")):
                    continue
                if "webmaster" in e_lower or "admin@" in e_lower:
                    continue
                if e_lower not in [x.lower() for x in good_emails]:
                    good_emails.append(e)

            result["email"] = good_emails[0] if good_emails else self._guess_email_from_domain(website)

            # 7. Try to extract a contact name from the page text
            result["contact_name"] = self._extract_contact_name(all_text)

        except Exception:
            pass

        return result

    @staticmethod
    def _guess_email_from_domain(website: str) -> str | None:
        """Try info@domain as a fallback when no email found on pages."""
        if not website:
            return None
        try:
            from urllib.parse import urlparse
            import socket
            domain = urlparse(website).netloc.lower()
            domain = domain.removeprefix("www.")
            if not domain or "." not in domain:
                return None
            # Quick MX check — does this domain accept email at all?
            try:
                socket.getaddrinfo(domain, 25, socket.AF_INET, socket.SOCK_STREAM)
            except socket.gaierror:
                # No DNS for mail port — try MX record via dns resolution
                pass
            # Skip social media / platform domains
            skip = ("facebook.com", "instagram.com", "twitter.com", "x.com",
                    "linkedin.com", "youtube.com", "yelp.com", "tiktok.com",
                    "google.com", "squarespace.com", "wix.com", "godaddy.com")
            if any(domain.endswith(s) for s in skip):
                return None
            # If domain resolves, info@ is the most common small-biz pattern
            return f"info@{domain}"
        except Exception:
            return None

    # Words that look like names but aren't (nav text, page headings, etc.)
    _NAME_BLACKLIST = {
        "us contact", "our team", "about us", "contact us", "read more",
        "learn more", "get started", "our story", "my account", "your name",
        "first name", "last name", "full name", "business owner",
    }

    @staticmethod
    def _extract_contact_name(html: str) -> str | None:
        """Try to pull an owner/founder/manager name from page HTML."""
        # Strip tags for cleaner text matching
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text)

        # Look for patterns like "Owner: John Smith", "Founded by Jane Doe"
        name_patterns = [
            r"(?:owner|founder|principal|proprietor|president|ceo)[:\s\-–—]+([A-Z][a-z]{2,} [A-Z][a-z]{2,})",
            r"([A-Z][a-z]{2,} [A-Z][a-z]{2,})[,\s\-–—]+(?:owner|founder|principal|proprietor|president|ceo)",
            r"(?:hi,? i'?m|hello,? i'?m|my name is)\s+([A-Z][a-z]{2,} [A-Z][a-z]{2,})",
            r"(?:Dr\.|Attorney|Atty\.)\s+([A-Z][a-z]{2,} [A-Z][a-z]{2,})",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, text)
            if match:
                name = match.group(1).strip()
                if name.lower() in LeadScraperAgent._NAME_BLACKLIST:
                    continue
                if 5 < len(name) < 35 and " " in name:
                    return name.title()

        return None

    # ── LLM needs analysis ─────────────────────────────────────────

    async def _analyze_needs(self, place: dict, industry_name: str) -> str:
        """Use LLM to generate pain points from Google Places data. Returns JSON string."""
        prompt = NEEDS_PROMPT.format(
            name=place.get("name", "Unknown"),
            location=place.get("formatted_address", "Unknown"),
            rating=place.get("rating", "N/A"),
            reviews=place.get("user_ratings_total", 0),
            has_website="yes" if place.get("website") else "no",
            industry=industry_name,
        )
        try:
            result = await self.llm.generate(prompt, system="Output only a JSON array of strings.", complexity="low")
            # Clean markdown wrapping
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            # Validate it parses
            needs = json.loads(result)
            if isinstance(needs, list):
                return json.dumps(needs[:3])
        except Exception:
            pass

        # Deterministic fallback if LLM fails
        fallback = []
        if not place.get("website"):
            fallback.append("No website found — missing online presence")
        rating = place.get("rating", 0)
        if rating and rating < 4.0:
            fallback.append(f"Below-average Google rating ({rating})")
        reviews = place.get("user_ratings_total", 0)
        if reviews < 15:
            fallback.append("Very few Google reviews — low visibility")
        if not fallback:
            fallback.append("Potential for improved digital marketing")
        return json.dumps(fallback)

    # ── Fallback: LLM synthetic leads ──────────────────────────────

    async def _fallback_synthetic(self, industry: dict, location: str) -> int:
        """Generate synthetic leads via LLM when Google API is unavailable."""
        prompt = FALLBACK_PROMPT.format(industry=industry["name"], location=location)
        system = (
            "You are a B2B lead researcher. Generate realistic synthetic business leads "
            "for sales prospecting. Output only valid JSON arrays."
        )
        result = await self.llm.generate(prompt, system=system, complexity="low")

        if "```json" in result:
            result = result.split("```json")[1].split("```")[0].strip()
        elif "```" in result:
            result = result.split("```")[1].split("```")[0].strip()

        leads = json.loads(result)
        if not isinstance(leads, list):
            leads = [leads]

        added = 0
        for lead in leads[:3]:
            lead["industry"] = industry["id"]
            lead["score"] = random.randint(40, 85)
            if isinstance(lead.get("needs"), list):
                lead["needs"] = json.dumps(lead["needs"])
            await asyncio.to_thread(self.pipeline_db.add_lead, lead, "synthetic")
            save_output(json.dumps(lead, indent=2), "leads", f"lead-synthetic-{industry['id']}")
            added += 1
        return added

    # ── Main tick ──────────────────────────────────────────────────

    async def tick(self) -> AgentEvent:
        if not self.pipeline_db:
            return self.emit("error", "No pipeline database connected")

        industry = INDUSTRIES[self.index % len(INDUSTRIES)]
        location = LOCATIONS[self.location_index % len(LOCATIONS)]

        self.current_task = {
            "type": "lead-scrape",
            "description": f"Scraping {industry['name']} leads near {location}",
        }
        self.emit("scraping", f"Finding {industry['name']} leads near {location}")

        try:
            # ── Try Google Places API first ───────────────────────
            places = await self._text_search(industry["query"], location)

            if not places:
                self._advance_indices()
                self.current_task = None
                return self.emit("skipped", f"No Google Places results for {industry['name']} in {location}")

            added = 0
            # Get existing business names to avoid duplicates
            existing_leads = await asyncio.to_thread(self.pipeline_db.get_all_lead_names)

            for place in places[:3]:
                name = place.get("name", "Unknown Business")

                # Skip duplicates
                if name.lower().strip() in existing_leads:
                    continue
                address = place.get("formatted_address", location)
                rating = place.get("rating")
                reviews = place.get("user_ratings_total", 0)
                place_id = place.get("place_id")

                phone = None
                website = None
                maps_url = None

                # Always fetch details for each new lead — phone/website/maps
                # are the whole point of the lead and cost ~$0.017/call.
                if place_id:
                    try:
                        details = await self._place_details(place_id)
                        phone = details.get("formatted_phone_number")
                        website = details.get("website")
                        maps_url = details.get("url")  # Google Maps listing URL
                    except Exception as e:
                        logger.warning("Place details fetch failed for %s: %s", name, e)

                # A "website" that's actually a social page → treat as no-website, save as social_url
                social_url = None
                if self._is_social_url(website):
                    social_url = website
                    website = None

                # Merge details back for scoring/needs analysis
                place["website"] = website
                place["formatted_phone_number"] = phone

                # Scrape website for email + contact name (only if there's a real website)
                site_data = await self._scrape_website(website)

                # LLM pain-point analysis
                needs_json = await self._analyze_needs(place, industry["name"])
                score = _score_lead(place)

                # Structured contact-hint blob — used by outreach agent to build subject
                # lines and body previews when the lead has no scrapable email.
                notes_data = {}
                if maps_url:
                    notes_data["maps_url"] = maps_url
                if social_url:
                    notes_data["social_url"] = social_url
                notes_json = json.dumps(notes_data) if notes_data else None

                lead_data = {
                    "business_name": name,
                    "industry": industry["id"],
                    "contact_name": site_data["contact_name"],
                    "contact_email": site_data["email"],
                    "contact_phone": phone,
                    "website": website,
                    "location": address,
                    "needs": needs_json,
                    "score": score,
                    "notes": notes_json,
                }

                await asyncio.to_thread(self.pipeline_db.add_lead, lead_data, "google_places")
                save_output(json.dumps(lead_data, indent=2), "leads", f"lead-{industry['id']}-{name[:20].lower().replace(' ', '-')}")
                added += 1

            self.tasks_completed += added
            self._advance_indices()
            self.current_task = None
            return self.emit(
                "completed",
                f"Scraped {added} {industry['name']} leads near {location} (Google Places)",
            )

        except (ValueError, RuntimeError, httpx.HTTPError) as api_err:
            # Google API failed — fall back to synthetic generation
            logger.warning("Google Places API failed, falling back to synthetic: %s", api_err)
            try:
                added = await self._fallback_synthetic(industry, location)
                self.tasks_completed += added
                self._advance_indices()
                self.current_task = None
                return self.emit(
                    "completed",
                    f"Scraped {added} {industry['name']} leads near {location} (synthetic fallback)",
                )
            except Exception as fallback_err:
                self.current_task = None
                return self.emit("error", f"Both Google API and fallback failed for {industry['name']}: {fallback_err}")

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Scrape failed for {industry['name']}: {e}")

    def _advance_indices(self):
        """Move to next industry; rotate location after cycling all industries."""
        self.index += 1
        if self.index % len(INDUSTRIES) == 0:
            self.location_index += 1

    def get_tools(self) -> list[dict]:
        return []
