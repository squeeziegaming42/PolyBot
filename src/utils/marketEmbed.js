const { EmbedBuilder } = require('discord.js');
const db = require('../database');

const STATUS_EMOJI = {
  open: '🟢',
  closed: '🔴',
  resolved: '✅',
  cancelled: '❌',
};

function buildMarketEmbed(market, outcomes) {
  const totalPool = db.getTotalBetOnMarket(market.id);

  const outcomeLines = outcomes.map((o, i) => {
    const total = db.getTotalBetOnOutcome(o.id);
    const pct   = totalPool > 0 ? ((total / totalPool) * 100).toFixed(1) : '0.0';
    const bar   = progressBar(Number(pct));
    const odds  = totalPool > 0 && total > 0 ? (totalPool / total).toFixed(2) : '—';

    const isWinner = market.winning_outcome === o.label;
    const prefix   = market.status === 'resolved'
      ? (isWinner ? '🏆 ' : '❌ ')
      : `**${i + 1}.** `;

    return `${prefix}**${o.label}**\n${bar} ${pct}% · 🪙 ${total.toLocaleString()} · odds ×${odds}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${STATUS_EMOJI[market.status]} Market #${market.id}`)
    .setDescription(`### ${market.question}`)
    .addFields({ name: 'Outcomes', value: outcomeLines.join('\n\n') || 'None' })
    .addFields(
      { name: '💰 Total Pool', value: `🪙 ${totalPool.toLocaleString()}`, inline: true },
      { name: '📊 Status',     value: market.status.charAt(0).toUpperCase() + market.status.slice(1), inline: true },
    )
    .setColor(
      market.status === 'open'      ? 0x57f287 :
      market.status === 'closed'    ? 0xfee75c :
      market.status === 'resolved'  ? 0x5865f2 :
      0xff4444
    )
    .setFooter({
      text: market.status === 'open'
        ? 'Use /bet to place your coins'
        : market.status === 'closed'
        ? 'Betting closed — awaiting resolution'
        : market.status === 'resolved'
        ? `Winner: ${market.winning_outcome}`
        : 'Market cancelled'
    })
    .setTimestamp();

  return embed;
}

function progressBar(pct, length = 12) {
  const filled = Math.round((pct / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = { buildMarketEmbed };
