"""Printables Designer Agent — generates professional, Etsy-ready financial templates.

All templates are built programmatically (no LLM dependency) to ensure
consistent, high-quality, print-ready HTML output every single time.
"""

import sys
import os
import random
import asyncio
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_base import BaseAgent, AgentEvent
from tools.file_tools import save_template, list_outputs, SAVE_TEMPLATE_SCHEMA, LIST_OUTPUTS_SCHEMA


# ---------------------------------------------------------------------------
# Template types
# ---------------------------------------------------------------------------
TEMPLATE_TYPES = {
    "trading-journal": "Trading Journal",
    "budget-planner": "Budget Planner",
    "expense-tracker": "Expense Tracker",
    "portfolio-tracker": "Portfolio Tracker",
    "net-worth": "Net Worth Worksheet",
    "debt-payoff": "Debt Payoff Tracker",
    "habit-tracker": "Habit Tracker",
    "goal-planner": "Goal Planner",
}

STYLES = ["modern", "classic", "minimal", "bold"]


# ---------------------------------------------------------------------------
# Style definitions — colors, fonts, border styles
# ---------------------------------------------------------------------------
def _get_style_vars(style: str) -> dict:
    """Return CSS variable values for the given style."""
    if style == "modern":
        return {
            "bg": "#1a1a2e",
            "surface": "#16213e",
            "surface_alt": "#1a2540",
            "text": "#e0e0e0",
            "text_muted": "#8892a4",
            "accent": "#00d4ff",
            "accent2": "#0fbcf9",
            "border": "#2a3a5c",
            "header_bg": "#0f3460",
            "header_text": "#ffffff",
            "row_alt": "rgba(0, 212, 255, 0.04)",
            "row_hover": "rgba(0, 212, 255, 0.08)",
            "font_heading": "'Helvetica Neue', Helvetica, Arial, sans-serif",
            "font_body": "'Helvetica Neue', Helvetica, Arial, sans-serif",
            "border_style": "1px solid",
            "border_radius": "4px",
            "input_bg": "rgba(255,255,255,0.06)",
            "input_border": "rgba(0, 212, 255, 0.3)",
            "positive": "#00e676",
            "negative": "#ff5252",
            "shadow": "0 2px 8px rgba(0,0,0,0.3)",
        }
    elif style == "classic":
        return {
            "bg": "#fdf6e3",
            "surface": "#faf3e0",
            "surface_alt": "#f5ecd4",
            "text": "#3e3228",
            "text_muted": "#8c7b6b",
            "accent": "#b8860b",
            "accent2": "#d4a843",
            "border": "#c9b99a",
            "header_bg": "#5c4a32",
            "header_text": "#fdf6e3",
            "row_alt": "rgba(184, 134, 11, 0.06)",
            "row_hover": "rgba(184, 134, 11, 0.10)",
            "font_heading": "Georgia, 'Times New Roman', serif",
            "font_body": "Georgia, 'Times New Roman', serif",
            "border_style": "1px solid",
            "border_radius": "2px",
            "input_bg": "#fffdf7",
            "input_border": "#c9b99a",
            "positive": "#2e7d32",
            "negative": "#c62828",
            "shadow": "0 1px 4px rgba(94,74,50,0.15)",
        }
    elif style == "minimal":
        return {
            "bg": "#ffffff",
            "surface": "#ffffff",
            "surface_alt": "#fafafa",
            "text": "#333333",
            "text_muted": "#999999",
            "accent": "#666666",
            "accent2": "#888888",
            "border": "#e0e0e0",
            "header_bg": "#f5f5f5",
            "header_text": "#333333",
            "row_alt": "#fafafa",
            "row_hover": "#f0f0f0",
            "font_heading": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            "font_body": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            "border_style": "1px solid",
            "border_radius": "0px",
            "input_bg": "#fafafa",
            "input_border": "#e0e0e0",
            "positive": "#2e7d32",
            "negative": "#d32f2f",
            "shadow": "none",
        }
    else:  # bold
        return {
            "bg": "#ffffff",
            "surface": "#ffffff",
            "surface_alt": "#f8f9fa",
            "text": "#212121",
            "text_muted": "#666666",
            "accent": "#1565c0",
            "accent2": "#e65100",
            "border": "#212121",
            "header_bg": "#212121",
            "header_text": "#ffffff",
            "row_alt": "rgba(21, 101, 192, 0.04)",
            "row_hover": "rgba(21, 101, 192, 0.08)",
            "font_heading": "'Helvetica Neue', Helvetica, Arial, sans-serif",
            "font_body": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            "border_style": "2px solid",
            "border_radius": "0px",
            "input_bg": "#f5f5f5",
            "input_border": "#212121",
            "positive": "#2e7d32",
            "negative": "#c62828",
            "shadow": "0 3px 0 rgba(0,0,0,0.12)",
        }


# ---------------------------------------------------------------------------
# Shared CSS generator
# ---------------------------------------------------------------------------
def _base_css(s: dict) -> str:
    """Generate the full base CSS block using style variables dict *s*."""
    return f"""
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}

    @page {{
      size: letter portrait;
      margin: 0.6in 0.5in 0.7in 0.5in;
    }}

    body {{
      font-family: {s['font_body']};
      font-size: 10pt;
      line-height: 1.45;
      color: {s['text']};
      background: {s['bg']};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    .page {{
      width: 7.5in;
      min-height: 10in;
      margin: 0 auto;
      padding: 0.4in 0;
      page-break-after: always;
    }}

    @media screen {{
      .page {{
        background: {s['surface']};
        box-shadow: {s['shadow']};
        margin: 20px auto;
        padding: 0.5in 0.6in;
        border-radius: {s['border_radius']};
      }}
      body {{ padding: 20px; }}
    }}

    /* Header */
    .template-header {{
      text-align: center;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: {s['border_style']} {s['accent']};
    }}
    .template-header h1 {{
      font-family: {s['font_heading']};
      font-size: 20pt;
      font-weight: 700;
      color: {s['accent']};
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }}
    .template-header .subtitle {{
      font-size: 9pt;
      color: {s['text_muted']};
      letter-spacing: 1px;
      text-transform: uppercase;
    }}
    .template-header .brand-space {{
      margin-top: 6px;
      font-size: 8pt;
      color: {s['text_muted']};
      font-style: italic;
    }}

    /* Section headings */
    .section-title {{
      font-family: {s['font_heading']};
      font-size: 11pt;
      font-weight: 700;
      color: {s['accent']};
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: {s['border_style']} {s['border']};
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }}

    /* Tables */
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
    }}
    th {{
      background: {s['header_bg']};
      color: {s['header_text']};
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 7px 8px;
      text-align: left;
      border: {s['border_style']} {s['border']};
    }}
    td {{
      padding: 6px 8px;
      border: {s['border_style']} {s['border']};
      vertical-align: top;
    }}
    tr:nth-child(even) td {{
      background: {s['row_alt']};
    }}
    tr:hover td {{
      background: {s['row_hover']};
    }}

    /* Input fields */
    .field {{
      display: inline-block;
      min-width: 60px;
      border-bottom: 1px solid {s['input_border']};
      padding: 2px 4px;
      color: {s['text_muted']};
      background: {s['input_bg']};
    }}
    .field-wide {{ min-width: 140px; }}
    .field-full {{ display: block; width: 100%; min-height: 20px; }}
    .field-box {{
      border: {s['border_style']} {s['input_border']};
      border-radius: {s['border_radius']};
      min-height: 22px;
      padding: 3px 6px;
      background: {s['input_bg']};
    }}

    /* Summary boxes */
    .summary-row {{
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }}
    .summary-box {{
      flex: 1;
      min-width: 120px;
      border: {s['border_style']} {s['border']};
      border-radius: {s['border_radius']};
      padding: 10px 12px;
      text-align: center;
      background: {s['surface_alt']};
    }}
    .summary-box .label {{
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: {s['text_muted']};
      margin-bottom: 4px;
    }}
    .summary-box .value {{
      font-size: 14pt;
      font-weight: 700;
      color: {s['accent']};
    }}

    /* Grid for habit tracker */
    .habit-grid {{
      display: grid;
      gap: 0;
    }}
    .habit-cell {{
      border: {s['border_style']} {s['border']};
      width: 22px;
      height: 22px;
      text-align: center;
      font-size: 7pt;
      line-height: 22px;
    }}
    .habit-cell.header-cell {{
      background: {s['header_bg']};
      color: {s['header_text']};
      font-weight: 600;
      font-size: 7pt;
    }}

    /* Footer */
    .template-footer {{
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid {s['border']};
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: {s['text_muted']};
    }}

    /* Positive / Negative colors */
    .positive {{ color: {s['positive']}; }}
    .negative {{ color: {s['negative']}; }}

    /* Notes area */
    .notes-area {{
      border: {s['border_style']} {s['border']};
      border-radius: {s['border_radius']};
      min-height: 60px;
      padding: 8px;
      margin-bottom: 12px;
      background: {s['input_bg']};
    }}

    /* Meta info row */
    .meta-row {{
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      font-size: 9pt;
    }}
    .meta-row .meta-item {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .meta-row .meta-label {{
      font-weight: 600;
      color: {s['text_muted']};
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.5px;
    }}

    /* Checkbox */
    .checkbox {{
      display: inline-block;
      width: 13px;
      height: 13px;
      border: {s['border_style']} {s['border']};
      border-radius: 2px;
      vertical-align: middle;
      margin-right: 4px;
    }}

    /* Progress bar */
    .progress-bar {{
      height: 10px;
      background: {s['surface_alt']};
      border: 1px solid {s['border']};
      border-radius: 5px;
      overflow: hidden;
    }}
    .progress-fill {{
      height: 100%;
      background: {s['accent']};
      border-radius: 5px;
    }}

    @media print {{
      body {{ background: white; }}
      .page {{
        box-shadow: none;
        margin: 0;
        padding: 0;
        width: 100%;
      }}
    }}
"""


def _html_wrap(title: str, style: str, body: str) -> str:
    """Wrap body content in a complete HTML document."""
    s = _get_style_vars(style)
    css = _base_css(s)
    style_label = style.capitalize()
    now = datetime.now().strftime("%Y")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — {style_label}</title>
<style>{css}</style>
</head>
<body>
<div class="page">

  <div class="template-header">
    <h1>{title}</h1>
    <div class="subtitle">{style_label} Edition</div>
    <div class="brand-space">Your Brand Here</div>
  </div>

{body}

  <div class="template-footer">
    <span>&copy; {now} &middot; Personal Use Only</span>
    <span>Page 1 of 1</span>
  </div>

</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Empty row helper
# ---------------------------------------------------------------------------
def _empty_rows(cols: int, rows: int = 12) -> str:
    """Generate *rows* empty table rows with *cols* cells."""
    lines = []
    for _ in range(rows):
        cells = "".join(f'<td><span class="field">&nbsp;</span></td>' for _ in range(cols))
        lines.append(f"    <tr>{cells}</tr>")
    return "\n".join(lines)


def _numbered_rows(cols: int, rows: int = 12) -> str:
    """Generate rows with first column numbered."""
    lines = []
    for i in range(1, rows + 1):
        cells = f'<td style="text-align:center;font-weight:600;">{i}</td>'
        cells += "".join(f'<td><span class="field">&nbsp;</span></td>' for _ in range(cols - 1))
        lines.append(f"    <tr>{cells}</tr>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Template builders — each returns the inner body HTML
# ---------------------------------------------------------------------------

def _build_trading_journal(style: str) -> str:
    s = _get_style_vars(style)
    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Date:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Account:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Starting Balance:</span>
      <span class="field">$</span>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Total Trades</div>
      <div class="value"><span class="field">&nbsp;</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Winners</div>
      <div class="value positive"><span class="field">&nbsp;</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Losers</div>
      <div class="value negative"><span class="field">&nbsp;</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Net P&amp;L</div>
      <div class="value"><span class="field">$</span></div>
    </div>
  </div>

  <h3 class="section-title">Trade Log</h3>
  <table>
    <thead>
      <tr>
        <th style="width:3%">#</th>
        <th style="width:10%">Time</th>
        <th style="width:10%">Instrument</th>
        <th style="width:6%">Side</th>
        <th style="width:8%">Entry</th>
        <th style="width:8%">Exit</th>
        <th style="width:6%">Size</th>
        <th style="width:9%">P&amp;L</th>
        <th style="width:13%">Strategy</th>
        <th style="width:10%">Emotion</th>
        <th style="width:17%">Notes</th>
      </tr>
    </thead>
    <tbody>
{_numbered_rows(11, 10)}
    </tbody>
  </table>

  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Win Rate</div>
      <div class="value"><span class="field">&nbsp;%</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Avg Winner</div>
      <div class="value positive"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Avg Loser</div>
      <div class="value negative"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Profit Factor</div>
      <div class="value"><span class="field">&nbsp;</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Ending Balance</div>
      <div class="value"><span class="field">$</span></div>
    </div>
  </div>

  <h3 class="section-title">Daily Reflection</h3>
  <table>
    <tr>
      <td style="width:50%;vertical-align:top;">
        <strong style="font-size:8pt;text-transform:uppercase;color:{s['text_muted']}">What went well:</strong>
        <div class="notes-area" style="min-height:50px;margin-top:4px;">&nbsp;</div>
      </td>
      <td style="width:50%;vertical-align:top;">
        <strong style="font-size:8pt;text-transform:uppercase;color:{s['text_muted']}">What to improve:</strong>
        <div class="notes-area" style="min-height:50px;margin-top:4px;">&nbsp;</div>
      </td>
    </tr>
  </table>

  <h3 class="section-title">Rules Followed</h3>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
    <span><span class="checkbox"></span> Followed stop-loss</span>
    <span><span class="checkbox"></span> Proper position sizing</span>
    <span><span class="checkbox"></span> Waited for setup</span>
    <span><span class="checkbox"></span> No revenge trading</span>
    <span><span class="checkbox"></span> Stuck to plan</span>
    <span><span class="checkbox"></span> Managed emotions</span>
  </div>
"""


def _build_budget_planner(style: str) -> str:
    s = _get_style_vars(style)
    income_cats = ["Salary / Wages", "Side Income", "Freelance", "Investments", "Other"]
    fixed_cats = ["Rent / Mortgage", "Utilities", "Insurance", "Car Payment", "Subscriptions", "Phone", "Internet"]
    variable_cats = ["Groceries", "Dining Out", "Gas / Transport", "Entertainment", "Shopping", "Personal Care", "Health"]
    savings_cats = ["Emergency Fund", "Retirement (401k/IRA)", "Investments", "Vacation Fund", "Other Savings"]

    def _category_table(title, categories, extra_col=""):
        header_extra = f"<th style='width:12%'>Notes</th>" if extra_col else ""
        rows = ""
        for cat in categories:
            extra_td = f"<td><span class='field'>&nbsp;</span></td>" if extra_col else ""
            rows += f"""    <tr>
      <td>{cat}</td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      {extra_td}
    </tr>\n"""
        # Total row
        extra_total = f"<td></td>" if extra_col else ""
        rows += f"""    <tr style="font-weight:700;background:{s['surface_alt']};">
      <td style="text-align:right;">TOTAL</td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      {extra_total}
    </tr>"""
        return f"""
  <h3 class="section-title">{title}</h3>
  <table>
    <thead>
      <tr>
        <th style="width:34%">Category</th>
        <th style="width:18%">Budgeted</th>
        <th style="width:18%">Actual</th>
        <th style="width:18%">Difference</th>
        {header_extra}
      </tr>
    </thead>
    <tbody>
{rows}
    </tbody>
  </table>"""

    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Month / Year:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Pay Period:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
  </div>

{_category_table("Income", income_cats)}
{_category_table("Fixed Expenses", fixed_cats)}
{_category_table("Variable Expenses", variable_cats, extra_col="notes")}
{_category_table("Savings &amp; Investments", savings_cats)}

  <div class="summary-row" style="margin-top:14px;">
    <div class="summary-box">
      <div class="label">Total Income</div>
      <div class="value positive"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Total Expenses</div>
      <div class="value negative"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Total Savings</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Net Remaining</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Savings Rate</div>
      <div class="value"><span class="field">&nbsp;%</span></div>
    </div>
  </div>
"""


def _build_expense_tracker(style: str) -> str:
    s = _get_style_vars(style)
    days_header = "".join(f"<th>Day {i}</th>" for i in range(1, 8))
    categories = ["Housing", "Food", "Transport", "Health", "Entertainment", "Shopping", "Bills", "Personal", "Other"]

    cat_rows = ""
    for cat in categories:
        cells = "".join(f'<td><span class="field">$</span></td>' for _ in range(7))
        cat_rows += f'    <tr><td style="font-weight:600;">{cat}</td>{cells}<td style="font-weight:700;"><span class="field">$</span></td></tr>\n'

    # Total row
    total_cells = "".join(f'<td style="font-weight:700;"><span class="field">$</span></td>' for _ in range(7))

    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Week Of:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Month:</span>
      <span class="field">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Budget Limit:</span>
      <span class="field">$</span>
    </div>
  </div>

  <h3 class="section-title">Weekly Expense Grid</h3>
  <table>
    <thead>
      <tr>
        <th style="width:14%">Category</th>
        {days_header}
        <th>Weekly Total</th>
      </tr>
    </thead>
    <tbody>
{cat_rows}
    <tr style="font-weight:700;background:{s['surface_alt']};">
      <td style="text-align:right;">DAILY TOTAL</td>
      {total_cells}
      <td style="font-weight:700;font-size:11pt;"><span class="field">$</span></td>
    </tr>
    </tbody>
  </table>

  <h3 class="section-title">Detailed Transactions</h3>
  <table>
    <thead>
      <tr>
        <th style="width:12%">Date</th>
        <th style="width:20%">Description</th>
        <th style="width:14%">Category</th>
        <th style="width:12%">Amount</th>
        <th style="width:14%">Payment Method</th>
        <th style="width:14%">Running Total</th>
        <th style="width:14%">Notes</th>
      </tr>
    </thead>
    <tbody>
{_numbered_rows(7, 14)}
    </tbody>
  </table>

  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Total Spent</div>
      <div class="value negative"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Budget Remaining</div>
      <div class="value positive"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Top Category</div>
      <div class="value"><span class="field">&nbsp;</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Daily Average</div>
      <div class="value"><span class="field">$</span></div>
    </div>
  </div>
"""


def _build_portfolio_tracker(style: str) -> str:
    s = _get_style_vars(style)
    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">As Of Date:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Account:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Benchmark:</span>
      <span class="field">&nbsp;</span>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Total Value</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Total Cost Basis</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Total Gain/Loss</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Return %</div>
      <div class="value"><span class="field">&nbsp;%</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Dividend Yield</div>
      <div class="value"><span class="field">&nbsp;%</span></div>
    </div>
  </div>

  <h3 class="section-title">Holdings</h3>
  <table>
    <thead>
      <tr>
        <th style="width:3%">#</th>
        <th style="width:14%">Asset / Name</th>
        <th style="width:8%">Ticker</th>
        <th style="width:8%">Shares</th>
        <th style="width:10%">Cost Basis</th>
        <th style="width:10%">Current Price</th>
        <th style="width:11%">Market Value</th>
        <th style="width:10%">Gain / Loss</th>
        <th style="width:8%">Return %</th>
        <th style="width:8%">Alloc %</th>
        <th style="width:10%">Sector</th>
      </tr>
    </thead>
    <tbody>
{_numbered_rows(11, 12)}
    </tbody>
  </table>

  <h3 class="section-title">Allocation Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th style="width:25%">Asset Class</th>
        <th style="width:20%">Value</th>
        <th style="width:15%">Current %</th>
        <th style="width:15%">Target %</th>
        <th style="width:25%">Rebalance Needed</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Stocks</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Bonds</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Real Estate / REITs</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Cash / Money Market</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Crypto</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Other</td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;%</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr style="font-weight:700;background:{s['surface_alt']};"><td style="text-align:right;">TOTAL</td><td><span class="field">$</span></td><td>100%</td><td>100%</td><td></td></tr>
    </tbody>
  </table>

  <h3 class="section-title">Notes &amp; Research</h3>
  <div class="notes-area" style="min-height:45px;">&nbsp;</div>
"""


def _build_net_worth(style: str) -> str:
    s = _get_style_vars(style)

    asset_categories = [
        ("Cash &amp; Savings", ["Checking Account", "Savings Account", "Cash on Hand", "Money Market"]),
        ("Investment Accounts", ["Brokerage", "401(k) / 403(b)", "IRA / Roth IRA", "HSA", "Other Investments"]),
        ("Real Estate", ["Primary Residence", "Rental Property", "Other Real Estate"]),
        ("Other Assets", ["Vehicle 1", "Vehicle 2", "Personal Property", "Business Value", "Other"]),
    ]

    liability_categories = [
        ("Short-Term Liabilities", ["Credit Card 1", "Credit Card 2", "Credit Card 3", "Medical Bills", "Other"]),
        ("Long-Term Liabilities", ["Mortgage", "Car Loan", "Student Loans", "Personal Loan", "HELOC", "Other"]),
    ]

    def _build_section(title, subcats, is_liability=False):
        html = f'  <h3 class="section-title">{title}</h3>\n'
        for sub_title, items in subcats:
            html += f'  <table>\n    <thead><tr><th style="width:40%">{sub_title}</th><th style="width:30%">Value</th><th style="width:30%">Notes</th></tr></thead>\n    <tbody>\n'
            for item in items:
                html += f'    <tr><td>{item}</td><td><span class="field">$</span></td><td><span class="field">&nbsp;</span></td></tr>\n'
            label = "Subtotal"
            html += f'    <tr style="font-weight:700;background:{s["surface_alt"]};"><td style="text-align:right;">{label}</td><td><span class="field">$</span></td><td></td></tr>\n'
            html += '    </tbody>\n  </table>\n'
        return html

    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Date:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Prepared By:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
  </div>

{_build_section("Assets", asset_categories)}

{_build_section("Liabilities", liability_categories, is_liability=True)}

  <div class="summary-row" style="margin-top:16px;">
    <div class="summary-box">
      <div class="label">Total Assets</div>
      <div class="value positive"><span class="field">$</span></div>
    </div>
    <div class="summary-box" style="font-size:18pt;display:flex;align-items:center;justify-content:center;color:{s['text_muted']};">
      &minus;
    </div>
    <div class="summary-box">
      <div class="label">Total Liabilities</div>
      <div class="value negative"><span class="field">$</span></div>
    </div>
    <div class="summary-box" style="font-size:18pt;display:flex;align-items:center;justify-content:center;color:{s['text_muted']};">
      =
    </div>
    <div class="summary-box" style="border-color:{s['accent']};border-width:2px;">
      <div class="label">Net Worth</div>
      <div class="value" style="font-size:16pt;"><span class="field">$</span></div>
    </div>
  </div>

  <h3 class="section-title">Monthly Net Worth Tracking</h3>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Assets</th>
        <th>Liabilities</th>
        <th>Net Worth</th>
        <th>Change</th>
        <th>Change %</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>January</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>February</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>March</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>April</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>May</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>June</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>July</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>August</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>September</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>October</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>November</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
      <tr><td>December</td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">$</span></td><td><span class="field">&nbsp;%</span></td></tr>
    </tbody>
  </table>
"""


def _build_debt_payoff(style: str) -> str:
    s = _get_style_vars(style)
    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Start Date:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Method:</span>
      <span><span class="checkbox"></span> Snowball (lowest balance first)</span>
      <span style="margin-left:8px;"><span class="checkbox"></span> Avalanche (highest rate first)</span>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Total Debt</div>
      <div class="value negative"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Total Monthly Payment</div>
      <div class="value"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Extra Monthly Payment</div>
      <div class="value positive"><span class="field">$</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Target Payoff Date</div>
      <div class="value"><span class="field">&nbsp;</span></div>
    </div>
  </div>

  <h3 class="section-title">Debt Overview</h3>
  <table>
    <thead>
      <tr>
        <th style="width:3%">#</th>
        <th style="width:16%">Debt Name</th>
        <th style="width:12%">Original Balance</th>
        <th style="width:12%">Current Balance</th>
        <th style="width:8%">APR %</th>
        <th style="width:11%">Min. Payment</th>
        <th style="width:11%">Extra Payment</th>
        <th style="width:11%">Total Payment</th>
        <th style="width:10%">Payoff Date</th>
        <th style="width:6%">Priority</th>
      </tr>
    </thead>
    <tbody>
{_numbered_rows(10, 8)}
    <tr style="font-weight:700;background:{s['surface_alt']};">
      <td></td>
      <td style="text-align:right;">TOTALS</td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      <td></td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      <td><span class="field">$</span></td>
      <td></td>
      <td></td>
    </tr>
    </tbody>
  </table>

  <h3 class="section-title">Monthly Payoff Progress</h3>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Payment Made</th>
        <th>To Interest</th>
        <th>To Principal</th>
        <th>Remaining Balance</th>
        <th>Progress</th>
      </tr>
    </thead>
    <tbody>
{_numbered_rows(6, 12)}
    </tbody>
  </table>

  <h3 class="section-title">Debt-Free Countdown</h3>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
    <span style="font-weight:600;color:{s['text_muted']};font-size:8pt;text-transform:uppercase;">Current Progress:</span>
    <div class="progress-bar" style="flex:1;">
      <div class="progress-fill" style="width:0%;"></div>
    </div>
    <span class="field" style="min-width:40px;text-align:center;">&nbsp;%</span>
  </div>

  <h3 class="section-title">Motivation &amp; Notes</h3>
  <div class="notes-area" style="min-height:40px;">&nbsp;</div>
"""


def _build_habit_tracker(style: str) -> str:
    s = _get_style_vars(style)
    days = list(range(1, 31))
    habits = [
        "Check budget",
        "No impulse buys",
        "Pack lunch",
        "Review portfolio",
        "Read 30 min",
        "Exercise",
        "No social media 1hr",
        "Save $1+",
        "Journal",
        "Gratitude list",
        "",
        "",
    ]

    # Build day headers
    day_headers = "".join(f'<th style="width:2.1%;padding:3px 1px;font-size:6.5pt;text-align:center;">{d}</th>' for d in days)

    habit_rows = ""
    for h in habits:
        cells = "".join(f'<td style="text-align:center;padding:2px 1px;"><span class="checkbox" style="width:11px;height:11px;"></span></td>' for _ in days)
        label = h if h else '<span class="field" style="min-width:80px;">&nbsp;</span>'
        habit_rows += f'    <tr><td style="font-size:8pt;font-weight:600;white-space:nowrap;">{label}</td>{cells}<td style="text-align:center;font-weight:600;"><span class="field" style="min-width:18px;">&nbsp;</span></td></tr>\n'

    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Month / Year:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Theme:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
  </div>

  <h3 class="section-title">30-Day Habit Grid</h3>
  <div style="overflow-x:auto;">
  <table style="font-size:7.5pt;">
    <thead>
      <tr>
        <th style="width:12%;font-size:7pt;">Habit</th>
        {day_headers}
        <th style="width:4%;font-size:6.5pt;text-align:center;">Total</th>
      </tr>
    </thead>
    <tbody>
{habit_rows}
    </tbody>
  </table>
  </div>

  <h3 class="section-title">Habit Scoring</h3>
  <div class="summary-row">
    <div class="summary-box">
      <div class="label">Completion Rate</div>
      <div class="value"><span class="field">&nbsp;%</span></div>
    </div>
    <div class="summary-box">
      <div class="label">Best Streak</div>
      <div class="value positive"><span class="field">&nbsp;</span> days</div>
    </div>
    <div class="summary-box">
      <div class="label">Habits Mastered</div>
      <div class="value"><span class="field">&nbsp;</span> / {len([h for h in habits if h])}</div>
    </div>
    <div class="summary-box">
      <div class="label">Monthly Grade</div>
      <div class="value"><span class="field">&nbsp;</span></div>
    </div>
  </div>

  <h3 class="section-title">Weekly Check-In</h3>
  <table>
    <thead>
      <tr>
        <th style="width:12%">Week</th>
        <th style="width:22%">Wins</th>
        <th style="width:22%">Challenges</th>
        <th style="width:22%">Adjustments</th>
        <th style="width:10%">Score</th>
        <th style="width:12%">Mood</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Week 1 (1-7)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Week 2 (8-14)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Week 3 (15-21)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Week 4 (22-30)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
    </tbody>
  </table>

  <h3 class="section-title">Monthly Reflection</h3>
  <div class="notes-area" style="min-height:50px;">&nbsp;</div>
"""


def _build_goal_planner(style: str) -> str:
    s = _get_style_vars(style)
    return f"""
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">Year:</span>
      <span class="field">&nbsp;</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Review Date:</span>
      <span class="field field-wide">&nbsp;</span>
    </div>
  </div>

  <h3 class="section-title">Vision Statement</h3>
  <div class="notes-area" style="min-height:35px;">&nbsp;</div>

  <h3 class="section-title">SMART Goals</h3>

  <!-- Goal 1 -->
  <div style="border:{s['border_style']} {s['border']};border-radius:{s['border_radius']};padding:12px;margin-bottom:12px;background:{s['surface_alt']};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-weight:700;color:{s['accent']};font-size:10pt;">Goal #1: <span class="field field-wide">&nbsp;</span></div>
      <div><span class="meta-label">Priority:</span> <span class="checkbox"></span> High <span class="checkbox"></span> Medium <span class="checkbox"></span> Low</div>
    </div>
    <table style="margin-bottom:6px;">
      <tr><td style="width:20%;font-weight:600;border:none;padding:3px 6px;">Specific</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Measurable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Achievable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Relevant</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Time-Bound</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
    </table>
    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
      <span class="meta-label">Target: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Current: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Deadline:</span><span class="field">&nbsp;</span>
      <div class="progress-bar" style="flex:1;"><div class="progress-fill" style="width:0%;"></div></div>
      <span class="field" style="min-width:30px;text-align:center;">&nbsp;%</span>
    </div>
  </div>

  <!-- Goal 2 -->
  <div style="border:{s['border_style']} {s['border']};border-radius:{s['border_radius']};padding:12px;margin-bottom:12px;background:{s['surface_alt']};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-weight:700;color:{s['accent']};font-size:10pt;">Goal #2: <span class="field field-wide">&nbsp;</span></div>
      <div><span class="meta-label">Priority:</span> <span class="checkbox"></span> High <span class="checkbox"></span> Medium <span class="checkbox"></span> Low</div>
    </div>
    <table style="margin-bottom:6px;">
      <tr><td style="width:20%;font-weight:600;border:none;padding:3px 6px;">Specific</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Measurable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Achievable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Relevant</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Time-Bound</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
    </table>
    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
      <span class="meta-label">Target: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Current: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Deadline:</span><span class="field">&nbsp;</span>
      <div class="progress-bar" style="flex:1;"><div class="progress-fill" style="width:0%;"></div></div>
      <span class="field" style="min-width:30px;text-align:center;">&nbsp;%</span>
    </div>
  </div>

  <!-- Goal 3 -->
  <div style="border:{s['border_style']} {s['border']};border-radius:{s['border_radius']};padding:12px;margin-bottom:12px;background:{s['surface_alt']};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-weight:700;color:{s['accent']};font-size:10pt;">Goal #3: <span class="field field-wide">&nbsp;</span></div>
      <div><span class="meta-label">Priority:</span> <span class="checkbox"></span> High <span class="checkbox"></span> Medium <span class="checkbox"></span> Low</div>
    </div>
    <table style="margin-bottom:6px;">
      <tr><td style="width:20%;font-weight:600;border:none;padding:3px 6px;">Specific</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Measurable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Achievable</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Relevant</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
      <tr><td style="font-weight:600;border:none;padding:3px 6px;">Time-Bound</td><td style="border:none;padding:3px 6px;"><span class="field field-full">&nbsp;</span></td></tr>
    </table>
    <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
      <span class="meta-label">Target: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Current: $</span><span class="field">&nbsp;</span>
      <span class="meta-label">Deadline:</span><span class="field">&nbsp;</span>
      <div class="progress-bar" style="flex:1;"><div class="progress-fill" style="width:0%;"></div></div>
      <span class="field" style="min-width:30px;text-align:center;">&nbsp;%</span>
    </div>
  </div>

  <h3 class="section-title">Action Items &amp; Milestones</h3>
  <table>
    <thead>
      <tr>
        <th style="width:3%"><span class="checkbox" style="border-color:{s['header_text']};"></span></th>
        <th style="width:7%">Goal #</th>
        <th style="width:28%">Action Item / Milestone</th>
        <th style="width:14%">Due Date</th>
        <th style="width:12%">Status</th>
        <th style="width:18%">Notes</th>
        <th style="width:18%">Result</th>
      </tr>
    </thead>
    <tbody>
{_empty_rows(7, 10)}
    </tbody>
  </table>

  <h3 class="section-title">Quarterly Review</h3>
  <table>
    <thead>
      <tr>
        <th style="width:12%">Quarter</th>
        <th style="width:22%">Progress Summary</th>
        <th style="width:22%">Obstacles</th>
        <th style="width:22%">Adjustments</th>
        <th style="width:10%">On Track?</th>
        <th style="width:12%">Confidence</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Q1 (Jan-Mar)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Q2 (Apr-Jun)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Q3 (Jul-Sep)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
      <tr><td>Q4 (Oct-Dec)</td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td><td><span class="field">&nbsp;</span></td></tr>
    </tbody>
  </table>
"""


# ---------------------------------------------------------------------------
# Template builder dispatch
# ---------------------------------------------------------------------------
TEMPLATE_BUILDERS = {
    "trading-journal": _build_trading_journal,
    "budget-planner": _build_budget_planner,
    "expense-tracker": _build_expense_tracker,
    "portfolio-tracker": _build_portfolio_tracker,
    "net-worth": _build_net_worth,
    "debt-payoff": _build_debt_payoff,
    "habit-tracker": _build_habit_tracker,
    "goal-planner": _build_goal_planner,
}


def generate_template(template_type: str, style: str) -> str:
    """Build a complete HTML template programmatically. No LLM needed."""
    builder = TEMPLATE_BUILDERS.get(template_type)
    if not builder:
        raise ValueError(f"Unknown template type: {template_type}")
    if style not in STYLES:
        raise ValueError(f"Unknown style: {style}. Choose from {STYLES}")

    title = TEMPLATE_TYPES[template_type]
    body = builder(style)
    return _html_wrap(title, style, body)


# ---------------------------------------------------------------------------
# Tool schemas (for agent framework introspection)
# ---------------------------------------------------------------------------
GENERATE_TEMPLATE_SCHEMA = {
    "name": "generate_template",
    "description": "Generate a professional, print-ready financial template",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_type": {
                "type": "string",
                "enum": list(TEMPLATE_TYPES.keys()),
                "description": "The type of financial template to generate",
            },
            "style": {
                "type": "string",
                "enum": STYLES,
                "default": "modern",
            },
        },
        "required": ["template_type"],
    },
}


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------
class PrintablesAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="printables-001",
            name="Printables Designer",
            description="Generates professional financial templates, trading journals, and planners for Etsy",
            color="#00d4ff",
        )
        self.tick_interval = 60
        self.pipeline_db = None
        self.template_queue = list(TEMPLATE_TYPES.keys())
        self.style_index = 0
        self.queue_index = 0

    async def tick(self) -> AgentEvent:
        """Generate one template per tick, rotating through types and styles."""
        template_type = self.template_queue[self.queue_index % len(self.template_queue)]
        style = STYLES[self.style_index % len(STYLES)]
        title = TEMPLATE_TYPES[template_type]

        # Emit working event
        self.current_task = {
            "type": template_type,
            "style": style,
            "description": f"Generating {title} ({style} style)",
        }

        working_event = self.emit(
            "generating",
            f"Creating {title} — {style} style",
        )

        try:
            # Build template programmatically (no LLM call)
            html_content = generate_template(template_type, style)

            # Save to output/printables/
            result = save_template(html_content, f"{template_type}-{style}", fmt="html")

            # Auto-convert to PDF for Etsy via Playwright (headless Chromium)
            pdf_path = None
            pdf_size = 0
            try:
                pdf_filename = result["filename"].replace(".html", ".pdf")
                pdf_filepath = Path(result["file"]).parent / pdf_filename
                html_abs = str(Path(result["file"]).resolve())

                def _render_pdf():
                    from playwright.sync_api import sync_playwright
                    with sync_playwright() as p:
                        browser = p.chromium.launch(headless=True)
                        page = browser.new_page()
                        page.goto(f"file:///{html_abs.replace(os.sep, '/')}")
                        page.pdf(path=str(pdf_filepath), format="Letter",
                                 margin={"top": "0.5in", "bottom": "0.5in",
                                         "left": "0.5in", "right": "0.5in"},
                                 print_background=True)
                        browser.close()

                await asyncio.to_thread(_render_pdf)
                pdf_path = str(pdf_filepath)
                pdf_size = pdf_filepath.stat().st_size
            except Exception as e:
                logger.warning(f"PDF conversion failed for {result['filename']}: {e}")

            # Track in Etsy pipeline
            if self.pipeline_db:
                try:
                    await asyncio.to_thread(
                        self.pipeline_db.add_item,
                        "etsy",
                        f"{title} ({style})",
                        subtitle=template_type,
                        stage="drafted",
                        score=random.randint(65, 90),
                        metadata={
                            "style": style,
                            "filename": result["filename"],
                            "template_type": template_type,
                            "size_bytes": result["size_bytes"],
                            "pdf_file": pdf_filename if pdf_path else None,
                            "pdf_size_bytes": pdf_size if pdf_path else 0,
                        },
                        source_agent=self.agent_id,
                    )
                except Exception:
                    pass

            self.tasks_completed += 1
            self.current_task = None

            # Advance rotation: cycle through all 4 styles, then next template type
            self.style_index += 1
            if self.style_index % len(STYLES) == 0:
                self.queue_index += 1

            pdf_info = f" + PDF ({pdf_size:,} bytes)" if pdf_path else ""
            return self.emit(
                "completed",
                f"Saved {title} ({style}) -> {result['filename']}{pdf_info}",
            )

        except Exception as e:
            self.current_task = None
            return self.emit("error", f"Failed to generate {title}: {e}")

    def get_tools(self) -> list[dict]:
        return [GENERATE_TEMPLATE_SCHEMA, SAVE_TEMPLATE_SCHEMA, LIST_OUTPUTS_SCHEMA]
