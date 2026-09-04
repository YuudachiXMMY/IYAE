ALTER TABLE users
  ADD COLUMN username VARCHAR(50) NULL,
  ADD COLUMN age_range VARCHAR(50) NULL,
  ADD COLUMN gender_identity VARCHAR(100) NULL,
  ADD COLUMN profile_visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN body_profile_visibility VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN style_aesthetics JSON NULL,
  ADD COLUMN fit_preferences JSON NULL,
  ADD COLUMN favorite_colors JSON NULL,
  ADD COLUMN avoided_colors JSON NULL,
  ADD COLUMN budget_range VARCHAR(50) NULL,
  ADD COLUMN favorite_brands JSON NULL,
  ADD COLUMN sustainable_fashion_interest TINYINT(1) NULL,
  ADD COLUMN price_preference VARCHAR(50) NULL,
  ADD COLUMN outfit_goals JSON NULL,
  ADD COLUMN avatar_mode VARCHAR(20) NULL,
  ADD COLUMN avatar_preset VARCHAR(100) NULL;

ALTER TABLE users ADD UNIQUE INDEX idx_users_username (username);

ALTER TABLE body_profiles
  ADD COLUMN shoulder_width_cm DOUBLE NULL,
  ADD COLUMN inseam_cm DOUBLE NULL,
  ADD COLUMN shoe_size VARCHAR(20) NULL,
  ADD COLUMN top_size VARCHAR(20) NULL,
  ADD COLUMN bottom_size VARCHAR(20) NULL,
  ADD COLUMN dress_size VARCHAR(20) NULL,
  ADD COLUMN jacket_size VARCHAR(20) NULL;
