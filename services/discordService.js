const axios = require("axios");
const logger = require("../utils/logger");

// Get Discord user guilds and check for admin/moderator roles
const getUserRoleFromDiscord = async (discordId, accessToken) => {
  try {
    // Get user's guilds (servers)
    const guildsResponse = await axios.get(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Get our Discord server ID from env
    const ourServerId = process.env.DISCORD_SERVER_ID;

    // Log untuk membantu debug
    logger.info(`Attempting to check roles with Server ID: ${ourServerId}`);

    if (!ourServerId) {
      logger.error(
        "DISCORD_SERVER_ID environment variable is missing or empty"
      );
      return "user";
    }

    // Check if user is in our server
    const userInOurServer = guildsResponse.data.find(
      (guild) => guild.id === ourServerId
    );

    if (!userInOurServer) {
      logger.info(`User ${discordId} is not in our Discord server`);
      return "user"; // Not in our server, assign regular user role
    }

    try {
      // Get member details including roles for our server
      const memberResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${ourServerId}/members/${discordId}`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      // Get admin and moderator role IDs from env
      const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
      const modRoleId = process.env.DISCORD_MODERATOR_ROLE_ID;

      // Check if user has admin or moderator role
      if (
        memberResponse.data.roles.includes(adminRoleId) ||
        memberResponse.data.roles.includes(modRoleId)
      ) {
        logger.info(`User ${discordId} has admin privileges`);
        return "admin";
      }

      logger.info(`User ${discordId} is a regular user`);
      return "user";
    } catch (error) {
      logger.error(`Failed to get member details: ${error.message}`);

      if (error.response?.status === 404) {
        logger.error(
          `Bot might not have access to the guild or the guild ID is incorrect`
        );
      }

      return "user"; // Default to user role on error
    }
  } catch (error) {
    logger.error(`Discord role check error: ${error.message}`);

    if (error.response) {
      logger.error(`Status code: ${error.response.status}`);
      logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }

    return "user"; // Default to user role on error
  }
};

module.exports = {
  getUserRoleFromDiscord,
};
