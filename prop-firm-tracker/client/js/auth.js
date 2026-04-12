"use strict";

const Auth = {
  SUPABASE_URL: '', // Set at deploy time or via config
  SUPABASE_ANON_KEY: '', // Set at deploy time or via config
  _client: null,
  _user: null,
  _token: null,

  async init() {
    // Load config from server
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const cfg = await res.json();
        this.SUPABASE_URL = cfg.supabaseUrl;
        this.SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
      }
    } catch { /* use defaults */ }

    if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
      console.error('Supabase config not available');
      return;
    }

    this._client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

    // Check for existing session
    const { data } = await this._client.auth.getSession();
    if (data?.session) {
      this._user = data.session.user;
      this._token = data.session.access_token;
    }

    // Listen for auth state changes
    this._client.auth.onAuthStateChange((_event, session) => {
      this._user = session?.user || null;
      this._token = session?.access_token || null;
    });
  },

  isLoggedIn() {
    return this._user != null && this._token != null;
  },

  getToken() {
    return this._token;
  },

  getUser() {
    return this._user;
  },

  async signUp(email, password) {
    if (!this._client) throw new Error('Auth not initialized');
    const { data, error } = await this._client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!this._client) throw new Error('Auth not initialized');
    const { data, error } = await this._client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._user = data.user;
    this._token = data.session.access_token;
    return data;
  },

  async signOut() {
    if (!this._client) return;
    await this._client.auth.signOut();
    this._user = null;
    this._token = null;
  },

  // Guard — redirect to auth page if not logged in
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/auth.html';
      return false;
    }
    return true;
  },
};
