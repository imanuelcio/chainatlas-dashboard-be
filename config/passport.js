const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const DiscordStrategy = require("passport-discord").Strategy;
const User = require("../models/User");
const { getUserRoleFromDiscord } = require("../services/discordService");

const setupPassport = (passport) => {
  // JWT Strategy for token authentication
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        const user = await User.findById(payload.id);
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    })
  );

  // Discord Strategy for OAuth
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL:
          "https://dashboard.atlashubs-bot.xyz/api/auth/discord/callback",
        // "http://localhost:5000/api/auth/discord/callback",
        scope: ["identify", "email", "guilds.members.read"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ discord_id: profile.id });

          if (user) {
            // Update user info if necessary
            user.username = user.username || profile.username;
            user.email = user.email || profile.email;

            // Check Discord roles and update user role if needed
            const discordRole = await getUserRoleFromDiscord(
              profile.id,
              accessToken
            );
            if (discordRole === "admin" || discordRole === "moderator") {
              user.role = "admin";
            }

            await user.save();
          } else {
            // Create new user
            const discordRole = await getUserRoleFromDiscord(
              profile.id,
              accessToken
            );

            user = new User({
              username: profile.username,
              email: profile.email,
              discord_id: profile.id,
              profile_image_url: profile.avatar
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : null,
              role:
                discordRole === "admin" || discordRole === "moderator"
                  ? "admin"
                  : "user",
            });

            await user.save();

            // Create initial user stats
            const { UserStats } = require("../models/UserStats");
            await UserStats.create({ user_id: user._id });
          }

          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
};

module.exports = { setupPassport };
