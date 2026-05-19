-- Update exact score points from 3 to 2
-- Affects group stage match predictions

UPDATE scoring_rules
SET pts = 2
WHERE rule_key = 'match_exact_score';
