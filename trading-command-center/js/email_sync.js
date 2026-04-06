"use strict";

const EmailSync = {
  API_URL: "http://localhost:5555",
  _status: null,

  async checkStatus() {
    try {
      const resp = await fetch(EmailSync.API_URL + "/api/status");
      if (!resp.ok) throw new Error("Server not reachable");
      EmailSync._status = await resp.json();
      return EmailSync._status;
    } catch {
      EmailSync._status = null;
      return null;
    }
  },

  async fetchUnsynced() {
    const resp = await fetch(EmailSync.API_URL + "/api/trades?unsynced=true");
    if (!resp.ok) throw new Error("Failed to fetch trades");
    return resp.json();
  },

  async markSynced(tradeIds) {
    const resp = await fetch(EmailSync.API_URL + "/api/trades/mark-synced", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade_ids: tradeIds }),
    });
    if (!resp.ok) throw new Error("Failed to mark synced");
    return resp.json();
  },

  async triggerPoll() {
    const resp = await fetch(EmailSync.API_URL + "/api/poll", { method: "POST" });
    if (!resp.ok) throw new Error("Failed to trigger poll");
    return resp.json();
  },

  async syncTrades(accountId) {
    /**
     * Fetch unsynced trades from the email monitor and import them
     * into the Trading Command Center's localStorage for the given account.
     * Returns { imported: number, errors: string[] }
     */
    const trades = await EmailSync.fetchUnsynced();
    if (!trades || trades.length === 0) return { imported: 0, errors: [] };

    const imported = [];
    const errors = [];

    for (const trade of trades) {
      try {
        const entry = {
          accountId: accountId,
          date: trade.date,
          pnl: trade.pnl,
          entryPrice: trade.entry_price,
          exitPrice: trade.exit_price,
          entryTime: trade.entry_time || "",
          exitTime: trade.exit_time || "",
          tradedBy: "bot",
          notes: "Auto-synced from TradingView email | " +
            trade.direction.toUpperCase() + " " + trade.symbol +
            " x" + trade.quantity +
            " | " + (trade.points >= 0 ? "+" : "") + trade.points.toFixed(1) + " pts",
        };
        Store.saveEntry(entry);
        imported.push(trade.id);
      } catch (e) {
        errors.push("Trade #" + trade.id + ": " + e.message);
      }
    }

    // Mark as synced on the server
    if (imported.length > 0) {
      try {
        await EmailSync.markSynced(imported);
      } catch {
        errors.push("Warning: trades imported but failed to mark as synced on server");
      }
    }

    return { imported: imported.length, errors };
  },

  async syncToMultipleAccounts(accountIds) {
    /**
     * Sync unsynced trades to multiple accounts at once.
     * Each trade gets duplicated to every selected account.
     */
    const trades = await EmailSync.fetchUnsynced();
    if (!trades || trades.length === 0) return { imported: 0, errors: [] };

    const allImported = [];
    const errors = [];

    for (const trade of trades) {
      for (const accountId of accountIds) {
        try {
          const entry = {
            accountId: accountId,
            date: trade.date,
            pnl: trade.pnl,
            entryPrice: trade.entry_price,
            exitPrice: trade.exit_price,
            entryTime: trade.entry_time || "",
            exitTime: trade.exit_time || "",
            tradedBy: "bot",
            notes: "Auto-synced from TradingView email | " +
              trade.direction.toUpperCase() + " " + trade.symbol +
              " x" + trade.quantity +
              " | " + (trade.points >= 0 ? "+" : "") + trade.points.toFixed(1) + " pts",
          };
          Store.saveEntry(entry);
        } catch (e) {
          errors.push("Trade #" + trade.id + " → " + accountId + ": " + e.message);
        }
      }
      allImported.push(trade.id);
    }

    if (allImported.length > 0) {
      try {
        await EmailSync.markSynced(allImported);
      } catch {
        errors.push("Warning: trades imported but failed to mark as synced on server");
      }
    }

    return { imported: allImported.length, errors };
  },
};
