-- Create user_settings table with proper RLS (Row Level Security)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dark_mode BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read only their own settings
CREATE POLICY "Users can read their own settings" 
  ON user_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own settings
CREATE POLICY "Users can insert their own settings" 
  ON user_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own settings
CREATE POLICY "Users can update their own settings" 
  ON user_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add this table to the public schema
GRANT ALL ON TABLE user_settings TO postgres;
GRANT ALL ON TABLE user_settings TO anon;
GRANT ALL ON TABLE user_settings TO authenticated;
GRANT ALL ON TABLE user_settings TO service_role;
