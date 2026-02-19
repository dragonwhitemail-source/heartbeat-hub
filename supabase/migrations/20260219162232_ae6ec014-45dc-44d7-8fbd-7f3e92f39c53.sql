
-- Clean all data from all tables (respecting foreign key order)
-- Child tables first, then parent tables

TRUNCATE TABLE task_comments CASCADE;
TRUNCATE TABLE task_status_history CASCADE;
TRUNCATE TABLE admin_tasks CASCADE;
TRUNCATE TABLE support_messages CASCADE;
TRUNCATE TABLE support_conversations CASCADE;
TRUNCATE TABLE referral_rewards CASCADE;
TRUNCATE TABLE referral_invites CASCADE;
TRUNCATE TABLE appeals CASCADE;
TRUNCATE TABLE generation_spends CASCADE;
TRUNCATE TABLE spend_sets CASCADE;
TRUNCATE TABLE generation_history CASCADE;
TRUNCATE TABLE balance_transactions CASCADE;
TRUNCATE TABLE balance_requests CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE feedback CASCADE;
TRUNCATE TABLE invite_codes CASCADE;
TRUNCATE TABLE team_pricing CASCADE;
TRUNCATE TABLE team_members CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE quotes CASCADE;
TRUNCATE TABLE payment_address_history CASCADE;
TRUNCATE TABLE payment_addresses CASCADE;
TRUNCATE TABLE referral_settings CASCADE;
TRUNCATE TABLE user_roles CASCADE;
TRUNCATE TABLE profiles CASCADE;
