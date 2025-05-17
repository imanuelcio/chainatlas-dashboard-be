const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const { generateNonce } = require("../utils/auth");
const { ethers } = require("ethers");

// Mock data
const testWallet = ethers.Wallet.createRandom();
const walletAddress = testWallet.address;

beforeAll(async () => {
  // Connect to test database
  await mongoose.connect(process.env.MONGODB_URI_TEST);

  // Clear users collection
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("Auth API", () => {
  let userId, nonce, token;

  test("Request nonce for wallet authentication", async () => {
    const res = await request(app)
      .post("/api/auth/wallet/nonce")
      .send({ address: walletAddress })
      .expect(200);

    expect(res.body).toHaveProperty("userId");
    expect(res.body).toHaveProperty("nonce");

    userId = res.body.userId;
    nonce = res.body.nonce;
  });

  test("Verify wallet signature", async () => {
    // Sign the nonce message with the wallet
    const signature = await testWallet.signMessage(nonce);

    const res = await request(app)
      .post("/api/auth/wallet/verify")
      .send({
        userId,
        address: walletAddress,
        signature,
      })
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.role).toBe("user");

    token = res.body.token;
  });

  test("Get user profile", async () => {
    const res = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toHaveProperty("wallet_address", walletAddress);
  });
});
