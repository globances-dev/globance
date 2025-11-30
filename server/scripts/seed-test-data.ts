import { getSupabaseQueryClient, getSupabaseEnvironmentInfo } from '../utils/supabase';
import { hashPassword, generateReferralCode } from '../utils/crypto';
import { signToken } from '../utils/jwt';

async function seedTestData() {
  const db = getSupabaseQueryClient();
  const envInfo = getSupabaseEnvironmentInfo();
  console.log(`🔗 Connected to ${envInfo.environment} database (${envInfo.database})\n`);
  try {
    console.log('🌱 Seeding test data for staging environment...\n');

    // Create 3 test users with referral chain: A → B → C
    console.log('📝 Creating test users (A → B → C referral chain)...');

    const userA = {
      email: 'test.user.a@globance.local',
      password_hash: await hashPassword('TestPassword123!'),
      full_name: 'Test User A',
      role: 'user',
      ref_code: generateReferralCode(),
    };

    // Create User A
    const userAResult = await db.exec(`
      INSERT INTO users (email, password_hash, username, verified, referral_code, role)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, referral_code
    `, [userA.email, userA.password_hash, userA.full_name, userA.ref_code, userA.role]);

    const createdUserA = userAResult.rows[0];
    console.log(`✅ User A created: ${createdUserA.email} (Ref: ${createdUserA.referral_code})`);

    // Create User B (referred by A)
    const userB = {
      email: 'test.user.b@globance.local',
      password_hash: await hashPassword('TestPassword123!'),
      full_name: 'Test User B',
      role: 'user',
      ref_code: generateReferralCode(),
      ref_by: createdUserA.id,
    };

    const userBResult = await db.exec(`
      INSERT INTO users (email, password_hash, username, verified, referral_code, role, referred_by)
      VALUES ($1, $2, $3, true, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, referral_code
    `, [userB.email, userB.password_hash, userB.full_name, userB.ref_code, userB.role, userB.ref_by]);

    const createdUserB = userBResult.rows[0];
    console.log(`✅ User B created: ${createdUserB.email} (Ref: ${createdUserB.referral_code}) → Referred by A`);

    // Create User C (referred by B)
    const userC = {
      email: 'test.user.c@globance.local',
      password_hash: await hashPassword('TestPassword123!'),
      full_name: 'Test User C',
      role: 'user',
      ref_code: generateReferralCode(),
      ref_by: createdUserB.id,
    };

    const userCResult = await db.exec(`
      INSERT INTO users (email, password_hash, username, verified, referral_code, role, referred_by)
      VALUES ($1, $2, $3, true, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, referral_code
    `, [userC.email, userC.password_hash, userC.full_name, userC.ref_code, userC.role, userC.ref_by]);

    const createdUserC = userCResult.rows[0];
    console.log(`✅ User C created: ${createdUserC.email} (Ref: ${createdUserC.referral_code}) → Referred by B\n`);

    // Create wallets for all users
    console.log('💰 Creating wallets...');

    for (const user of [createdUserA, createdUserB, createdUserC]) {
      await db.exec(`
        INSERT INTO wallets (user_id, usdt_balance)
        VALUES ($1, 0)
        ON CONFLICT (user_id) DO NOTHING
      `, [user.id]);
    }

    console.log('✅ Wallets created for all users\n');

    // Create test admin user
    console.log('👨‍💼 Creating admin user...');

    const adminUser = {
      email: 'test.admin@globance.local',
      password_hash: await hashPassword('AdminPassword123!'),
      full_name: 'Test Admin',
      role: 'admin',
      ref_code: generateReferralCode(),
    };

    const adminResult = await db.exec(`
      INSERT INTO users (email, password_hash, username, verified, referral_code, role)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
      RETURNING id, email
    `, [adminUser.email, adminUser.password_hash, adminUser.full_name, adminUser.ref_code, adminUser.role]);

    const createdAdmin = adminResult.rows[0];

    // Create admin wallet
    await db.exec(`
      INSERT INTO wallets (user_id, usdt_balance)
      VALUES ($1, 0)
      ON CONFLICT (user_id) DO NOTHING
    `, [createdAdmin.id]);

    console.log(`✅ Admin user created: ${createdAdmin.email}\n`);

    // Create deposit addresses for all users
    console.log('🔗 Creating mock deposit addresses...');

    const addresses = [
      { user_id: createdUserA.id, network: 'TRC20', address: `mock_trc20_${createdUserA.id.slice(0, 8)}` },
      { user_id: createdUserA.id, network: 'BEP20', address: `mock_bep20_${createdUserA.id.slice(0, 8)}` },
      { user_id: createdUserB.id, network: 'TRC20', address: `mock_trc20_${createdUserB.id.slice(0, 8)}` },
      { user_id: createdUserB.id, network: 'BEP20', address: `mock_bep20_${createdUserB.id.slice(0, 8)}` },
      { user_id: createdUserC.id, network: 'TRC20', address: `mock_trc20_${createdUserC.id.slice(0, 8)}` },
      { user_id: createdUserC.id, network: 'BEP20', address: `mock_bep20_${createdUserC.id.slice(0, 8)}` },
    ];

    for (const addr of addresses) {
      await db.exec(`
        INSERT INTO deposit_addresses (user_id, network, address, provider)
        VALUES ($1, $2, $3, 'mock_test')
        ON CONFLICT DO NOTHING
      `, [addr.user_id, addr.network, addr.address]);
    }

    console.log('✅ Mock deposit addresses created for all users\n');

    // Generate JWT tokens for testing
    console.log('🔐 Generating test JWT tokens...');

    const tokenA = signToken({
      id: createdUserA.id,
      email: createdUserA.email,
      role: 'user',
    });

    const tokenB = signToken({
      id: createdUserB.id,
      email: createdUserB.email,
      role: 'user',
    });

    const tokenC = signToken({
      id: createdUserC.id,
      email: createdUserC.email,
      role: 'user',
    });

    const tokenAdmin = signToken({
      id: createdAdmin.id,
      email: createdAdmin.email,
      role: 'admin',
    });

    console.log('✅ JWT tokens generated\n');

    // Print test data summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 STAGING TEST DATA READY!');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📋 TEST USERS:\n');

    console.log('USER A (Referrer)');
    console.log(`  Email: ${createdUserA.email}`);
    console.log(`  Password: TestPassword123!`);
    console.log(`  Referral Code: ${createdUserA.referral_code}`);
    console.log(`  User ID: ${createdUserA.id}`);
    console.log(`  Token: ${tokenA}\n`);

    console.log('USER B (Referred by A, Referrer of C)');
    console.log(`  Email: ${createdUserB.email}`);
    console.log(`  Password: TestPassword123!`);
    console.log(`  Referral Code: ${createdUserB.referral_code}`);
    console.log(`  User ID: ${createdUserB.id}`);
    console.log(`  Token: ${tokenB}\n`);

    console.log('USER C (Referred by B)');
    console.log(`  Email: ${createdUserC.email}`);
    console.log(`  Password: TestPassword123!`);
    console.log(`  Referral Code: ${createdUserC.referral_code}`);
    console.log(`  User ID: ${createdUserC.id}`);
    console.log(`  Token: ${tokenC}\n`);

    console.log('ADMIN');
    console.log(`  Email: ${createdAdmin.email}`);
    console.log(`  Password: AdminPassword123!`);
    console.log(`  User ID: ${createdAdmin.id}`);
    console.log(`  Token: ${tokenAdmin}\n`);

    console.log('═══════════════════════════════════════════════════════\n');

    console.log('💡 REFERRAL CHAIN: A → B → C\n');
    console.log('   - User B referred by User A (get 3% on B earnings)');
    console.log('   - User C referred by User B (get 3% on C earnings)\n');

    console.log('🚀 Next steps:');
    console.log('   1. Use the tokens above to test the API');
    console.log('   2. Run mock deposits using /api/debug/mock-deposit');
    console.log('   3. Run daily earnings using /api/debug/run-daily-earnings');
    console.log('   4. Check the /api/debug/logs endpoint for debug logs\n');

  } catch (error: any) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedTestData().then(() => {
  console.log('✨ Seeding complete!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
