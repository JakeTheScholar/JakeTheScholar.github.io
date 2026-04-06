"use strict";

const Rules = {
  PRESETS: {
    // --- Apex ---
    apex_50k_eval: {
      name: 'Apex 50K Eval',
      startingBalance: 50000,
      profitTarget: 3000,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: null,
      minTradingDays: 0,
      drawdownStopsAtTarget: true,
    },
    apex_50k_funded: {
      name: 'Apex 50K Funded (PA)',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: 0.50,
      minTradingDays: 8,
      drawdownStopsAtTarget: false,
    },
    // --- Topstep ---
    topstep_50k_normal: {
      name: 'Topstep 50K Normal XFA',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: 1000,
      consistencyPct: 0.50,
      minTradingDays: 5,
      minDayAmount: 150,
      drawdownStopsAtTarget: false,
    },
    topstep_50k_consistency: {
      name: 'Topstep 50K Consistency XFA',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: 1000,
      consistencyPct: 0.40,
      minTradingDays: 3,
      minDayAmount: null,
      drawdownStopsAtTarget: false,
    },
    // --- MyFundedFutures ---
    mff_core_50k_eval: {
      name: 'MFF Core 50K Eval',
      startingBalance: 50000,
      profitTarget: 3000,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: 0.50,
      minTradingDays: 5,
      drawdownStopsAtTarget: true,
    },
    mff_core_50k_funded: {
      name: 'MFF Core 50K Funded',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: 0.40,
      minTradingDays: 5,
      minDayAmount: null,
      drawdownStopsAtTarget: true,
    },
    mff_rapid_50k_eval: {
      name: 'MFF Rapid 50K Eval',
      startingBalance: 50000,
      profitTarget: 3000,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: 0.50,
      minTradingDays: 2,
      drawdownStopsAtTarget: true,
    },
    mff_rapid_50k_funded: {
      name: 'MFF Rapid 50K Funded',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: null,
      minTradingDays: 0,
      drawdownStopsAtTarget: true,
    },
    // --- Alpha Futures ---
    alpha_50k_eval: {
      name: 'Alpha Futures 50K Eval',
      startingBalance: 50000,
      profitTarget: 3000,
      trailingDrawdown: 2000,
      dailyLossLimit: null,
      consistencyPct: 0.50,
      minTradingDays: 0,
      drawdownStopsAtTarget: true,
    },
    alpha_50k_funded: {
      name: 'Alpha Futures 50K Funded',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2000,
      dailyLossLimit: 1000,
      consistencyPct: 0.40,
      minTradingDays: 0,
      drawdownStopsAtTarget: true,
    },
    // --- Lucid Trading (LucidFlex) ---
    lucid_50k_eval: {
      name: 'Lucid 50K Eval',
      startingBalance: 50000,
      profitTarget: 3000,
      trailingDrawdown: 2500,
      dailyLossLimit: null,
      consistencyPct: 0.50,
      minTradingDays: 2,
      drawdownStopsAtTarget: true,
    },
    lucid_50k_funded: {
      name: 'Lucid 50K Funded',
      startingBalance: 50000,
      profitTarget: null,
      trailingDrawdown: 2500,
      dailyLossLimit: null,
      consistencyPct: null,
      minTradingDays: 5,
      minDayAmount: 150,
      drawdownStopsAtTarget: true,
    },
  },

  // Backward compat aliases
  _aliases: { topstep_50k_funded: 'topstep_50k_normal', mff_50k_eval: 'mff_rapid_50k_eval', mff_50k_funded: 'mff_rapid_50k_funded' },

  getPreset(key) {
    const resolved = this._aliases[key] || key;
    return this.PRESETS[resolved] || null;
  },

  dailyPnl(entries) {
    const byDate = {};
    entries.forEach(e => {
      byDate[e.date] = (byDate[e.date] || 0) + e.pnl;
    });
    return Object.keys(byDate).sort().map(date => ({ date, pnl: byDate[date] }));
  },

  compute(account, entries) {
    const preset = this.getPreset(account.rules);
    const startBal = account.startingBalance;
    const daily = this.dailyPnl(entries);
    const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);
    const currentBalance = startBal + totalPnl;

    // Account-level drawdown overrides preset
    const drawdownAmt = account.trailingDrawdown != null ? account.trailingDrawdown : (preset ? preset.trailingDrawdown : 0);

    let runningBalance = startBal;
    let highestBalance = startBal;
    let trailingFloor = startBal - drawdownAmt;

    const equityCurve = [{ date: null, balance: startBal, floor: trailingFloor }];

    daily.forEach(d => {
      runningBalance += d.pnl;
      if (runningBalance > highestBalance) {
        highestBalance = runningBalance;
      }

      if (drawdownAmt > 0) {
        let newFloor = highestBalance - drawdownAmt;
        if (preset && preset.drawdownStopsAtTarget && preset.profitTarget) {
          const targetBalance = startBal + preset.profitTarget;
          if (highestBalance >= targetBalance) {
            newFloor = Math.min(newFloor, targetBalance - drawdownAmt);
          }
        }
        trailingFloor = Math.max(trailingFloor, newFloor);
      }

      equityCurve.push({ date: d.date, balance: runningBalance, floor: trailingFloor });
    });

    const cushion = currentBalance - trailingFloor;

    const wins = entries.filter(e => e.pnl > 0);
    const losses = entries.filter(e => e.pnl < 0);
    const winRate = entries.length > 0 ? wins.length / entries.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, e) => s + e.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, e) => s + e.pnl, 0) / losses.length : 0;
    const grossWins = wins.reduce((s, e) => s + e.pnl, 0);
    const grossLosses = Math.abs(losses.reduce((s, e) => s + e.pnl, 0));
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

    const tradingDays = new Set(entries.map(e => e.date)).size;

    const today = UI.today();
    const todayPnl = entries.filter(e => e.date === today).reduce((s, e) => s + e.pnl, 0);

    let dailyLossWarning = false;
    let dailyLossHit = false;
    if (preset && preset.dailyLossLimit) {
      const todayLoss = Math.abs(Math.min(0, todayPnl));
      dailyLossWarning = todayLoss >= preset.dailyLossLimit * 0.8;
      dailyLossHit = todayLoss >= preset.dailyLossLimit;
    }

    let consistencyOk = true;
    let bestDayPct = 0;
    let bestDayPnl = 0;
    let bestDayDate = null;
    let consistencyTarget = null;
    if (preset && preset.consistencyPct && totalPnl > 0) {
      const dailyTotals = daily.map(d => ({ date: d.date, pnl: d.pnl }));
      const bestDay = dailyTotals.reduce((best, d) => d.pnl > best.pnl ? d : best, { pnl: 0, date: null });
      bestDayPnl = bestDay.pnl;
      bestDayPct = bestDay.pnl / totalPnl;
      bestDayDate = bestDay.date;
      consistencyOk = bestDayPct < preset.consistencyPct;
      // How much total P&L is needed for consistency to pass
      consistencyTarget = bestDay.pnl / preset.consistencyPct;
    }

    let evalProgress = null;
    let projectedDays = null;
    if (preset && preset.profitTarget) {
      evalProgress = Math.max(0, totalPnl / preset.profitTarget);
      if (tradingDays >= 3 && totalPnl > 0) {
        const avgDaily = totalPnl / tradingDays;
        const remaining = preset.profitTarget - totalPnl;
        projectedDays = remaining > 0 ? Math.ceil(remaining / avgDaily) : 0;
      }
    }

    let payoutEligible = false;
    if (preset && preset.minTradingDays > 0) {
      payoutEligible = tradingDays >= preset.minTradingDays && consistencyOk && currentBalance > startBal;
    }

    return {
      currentBalance,
      totalPnl,
      highestBalance,
      trailingFloor,
      cushion,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      tradingDays,
      todayPnl,
      dailyLossWarning,
      dailyLossHit,
      consistencyOk,
      bestDayPnl,
      bestDayPct,
      bestDayDate,
      consistencyTarget,
      evalProgress,
      projectedDays,
      payoutEligible,
      equityCurve,
      dailyPnl: daily,
    };
  },

  alerts(accounts, journal) {
    const alerts = [];
    accounts.filter(a => a.status === 'active').forEach(a => {
      const entries = journal.filter(j => j.accountId === a.id);
      const stats = this.compute(a, entries);
      const preset = this.getPreset(a.rules);

      if (stats.dailyLossHit) {
        alerts.push({ type: 'danger', account: a.name, message: a.name + ': daily loss limit hit — stop trading this account today' });
      } else if (stats.dailyLossWarning && preset) {
        const todayLoss = Math.abs(Math.min(0, stats.todayPnl));
        alerts.push({ type: 'warning', account: a.name, message: a.name + ': daily loss at ' + UI.currency(todayLoss) + ' / ' + UI.currency(preset.dailyLossLimit) + ' limit' });
      }

      if (!stats.consistencyOk) {
        alerts.push({ type: 'warning', account: a.name, message: a.name + ': consistency rule violated — best day is ' + UI.pct(stats.bestDayPct * 100) + ' of total profit' });
      }
    });
    return alerts;
  },

  portfolioStats(accounts, journal, startDate, endDate) {
    const filtered = endDate
      ? journal.filter(j => j.date >= startDate && j.date <= endDate)
      : journal.filter(j => j.date >= startDate);

    const totalPnl = filtered.reduce((s, e) => s + e.pnl, 0);
    const wins = filtered.filter(e => e.pnl > 0);
    const winRate = filtered.length > 0 ? wins.length / filtered.length : 0;

    const byDate = {};
    filtered.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + e.pnl; });
    const dailyArr = Object.keys(byDate).sort().map(d => ({ date: d, pnl: byDate[d] }));

    const tradingDays = dailyArr.length;
    const avgDaily = tradingDays > 0 ? totalPnl / tradingDays : 0;
    const bestDay = dailyArr.length > 0 ? dailyArr.reduce((b, d) => d.pnl > b.pnl ? d : b, dailyArr[0]) : null;
    const worstDay = dailyArr.length > 0 ? dailyArr.reduce((w, d) => d.pnl < w.pnl ? d : w, dailyArr[0]) : null;

    let cumulative = 0;
    const equityCurve = dailyArr.map(d => {
      cumulative += d.pnl;
      return { date: d.date, balance: cumulative, pnl: d.pnl };
    });

    return {
      totalPnl, winRate, avgDaily, tradingDays,
      bestDay, worstDay, equityCurve,
      tradeCount: filtered.length,
    };
  },

  dateRange(range) {
    const now = new Date();
    const today = UI.today();
    switch (range) {
      case 'today':
        return { start: today, end: today };
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay() + 1);
        return { start: d.toISOString().slice(0, 10), end: today };
      }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: d.toISOString().slice(0, 10), end: today };
      }
      case 'year': {
        return { start: now.getFullYear() + '-01-01', end: today };
      }
      case 'all':
      default:
        return { start: '2000-01-01', end: today };
    }
  },
};
