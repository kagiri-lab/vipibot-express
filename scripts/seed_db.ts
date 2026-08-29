import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const seedDatabase = async () => {
  try {
    console.log('Connecting to database...');
    // Dynamically import models so env variables are available
    const { User, TwitterAccount, Mention } = await import('../src/models');
    const { default: sequelize } = await import('../src/config/database');

    await sequelize.authenticate();
    console.log('Database connected. Starting seed...');

    // 1. Create a default User
    const passwordHash = await bcrypt.hash('password123', 10);
    let user = await User.findOne({ where: { username: 'admin' } });
    if (!user) {
      user = await User.create({
        username: 'admin',
        passwordHash,
        initials: 'NK',
        role: 'SUPER_ADMIN',
      });
      console.log('Created default user: admin / password123 (Initials: NK)');
    } else {
      console.log('Default user already exists.');
    }

    // 2. Create a mock Twitter Account
    let account = await TwitterAccount.findOne({ where: { handle: 'vipi_official' } });
    if (!account) {
      account = await TwitterAccount.create({
        handle: 'vipi_official',
        apiKey: 'mock_api_key',
        apiSecret: 'mock_api_secret',
        accessToken: 'mock_access_token',
        accessTokenSecret: 'mock_access_token_secret',
        isActive: false // Set to false so sync doesn't actually try to hit X API with mock keys
      });
      console.log('Created mock Twitter account: @vipi_official');
    }

    // 3. Create a mock Mention
    if (account) {
      let mention = await Mention.findOne({ where: { tweetId: 'mock_tweet_123' } });
      if (!mention) {
        mention = await Mention.create({
          twitterAccountId: (account as any).id,
          tweetId: 'mock_tweet_123',
          authorUsername: 'curious_dev',
          text: '@vipi_official How do I integrate this new feature?',
          parentTweetId: 'mock_parent_123',
          parentTweetText: 'We just released our new API portal!',
          status: 'PENDING'
        });
        console.log('Created mock mention from @curious_dev');
      }
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedDatabase();
