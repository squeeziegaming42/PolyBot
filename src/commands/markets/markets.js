const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('markets')
    .setDescription('List all active prediction markets (open and closed)'),

  async execute(interaction) {
    const allMarkets = db.all(
      `SELECT * FROM markets WHERE guild_id = ? AND status IN ('open', 'closed') ORDER BY status ASC, created_at DESC`,
      [interaction.guildId]
    );

    if (allMarkets.length === 0) {
      return interaction.reply({ content: '📭 No active markets right now. Admins can create one with `/market-create`.', flags: 64 });
    }

    const openMarkets   = allMarkets.filter(m => m.status === 'open');
    const closedMarkets = allMarkets.filter(m => m.status === 'closed');

    const formatMarket = m => {
      const pool     = db.getTotalBetOnMarket(m.id);
      const outcomes = db.getMarketOutcomes(m.id);
      const outcomeList = outcomes.map((o, i) => `${i + 1}. ${o.label}`).join(' · ');
      return `**#${m.id} — ${m.question}**\n> ${outcomeList}\n> 🪙 ${pool.toLocaleString()} in pool`;
    };

    const fields = [];

    if (openMarkets.length > 0) {
      fields.push({
        name: '🟢 Open — betting live',
        value: openMarkets.map(formatMarket).join('\n\n'),
      });
    }

    if (closedMarkets.length > 0) {
      fields.push({
        name: '🔴 Closed — awaiting resolution',
        value: closedMarkets.map(formatMarket).join('\n\n'),
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Prediction Markets')
      .addFields(fields)
      .setColor(0x5865f2)
      .setFooter({ text: 'Use /bet <market id> <outcome number> <amount> · /market <id> for full odds' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
