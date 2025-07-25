const { ApplicationCommandType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const con = require('../../function/db');
const queryAsync = require('../../function/queryAsync');
const { isVerified } = require("../../function/roles");
const { givePoints } = require("../../function/furrygame");
const awardCumRole = require("../../function/awardroles");

module.exports = {
    name: 'icame',
    description: 'Increase your cum count',
    cooldown: 3000,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'amount',
            description: 'How much you came?',
            type: 3,
            required: true,
            choices: [
                { name: 'Small Load', value: '2' },
                { name: 'Medium Load', value: '5' },
                { name: 'Large Load', value: '10' },
                { name: 'Massive Load', value: '15' },
            ]
        },
        {
            name: 'image',
            description: 'Upload proof of your cum',
            type: 11,
            required: false
        }
    ],
    run: async (client, interaction) => {
        const { member, options } = interaction;
        const userId = member.id;
        const image = options.getAttachment('image');
        const now = Date.now();
        const cooldown = 60 * 60 * 1000; // 1 hour in ms

        try {
            // Check cooldown from DB
            const res = await queryAsync(con, `SELECT last_used FROM cumcount WHERE user=?`, [userId]);
            if (res.length > 0 && res[0].last_used && (now - Number(res[0].last_used)) < cooldown) {
                const remaining = Math.ceil((cooldown - (now - Number(res[0].last_used))) / 60000);
                return await interaction.reply({ content: `You must wait ${remaining} more minute(s) before using this command again.`, ephemeral: true });
            }

            // Check if the user is verified
            if (!(await isVerified(userId))) {
                return await interaction.reply({ content: 'You must be verified to use this command.', ephemeral: true });
            }

            // Get current cum count
            const res2 = await queryAsync(con, `SELECT * FROM cumcount WHERE user=?`, [userId]);
            const currentCumCount = res2.length > 0 ? res2[0].count : 0;
            const cumAmount = parseInt(options.getString('amount') || 5);

            // Insert or update cumcount row and update last_used
            await queryAsync(
                con,
                `INSERT INTO cumcount (user, count, amount, last_used) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE count = count + 1, amount = amount + ?, last_used = ?`,
                [userId, cumAmount, now, cumAmount, now]
            );

            // Prepare embed
            const embed = new EmbedBuilder()
                .setTitle(`${member.displayName} came!`)
                .setDescription(`${member} has just let it loose, and produced roughly :milk: \
\`${cumAmount} ml of fresh milk\`! They have ejaculated a total of **${currentCumCount + 1}** times.`)
                .setColor("#FFFFFF")
                .setThumbnail(member.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `You can cum too with command /icame`, iconURL: member.guild.iconURL() })
                .setTimestamp();
            if (image && image.url) {
                embed.setImage(image.url);
            }

            // Award cumcoins
            const coins = image ? 10 : 5;
            givePoints(userId, coins);
            awardCumRole();

            // Add revert button
            const revertButton = new ButtonBuilder()
                .setCustomId(`revert-${userId}-${coins}-${cumAmount}`)
                .setLabel('Revert')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄');
            const row = new ActionRowBuilder().addComponents(revertButton);

            // Send embed to log channel
            const logChannel = member.guild.channels.cache.get('1397631559317586014');
            if (logChannel) {
                await logChannel.send({ embeds: [embed], components: [row] });
            }

            await interaction.reply({ content: `Your cum count has been increased! You received ${coins} cumcoins.`, ephemeral: true });
        } catch (err) {
            console.error('Database error:', err);
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
};