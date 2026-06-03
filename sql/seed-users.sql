-- Gebruikers Ben en Ineke voor huishouden THUIS
USE boodschap;

INSERT INTO users (display_name)
SELECT 'Ben'
WHERE NOT EXISTS (
  SELECT 1 FROM users u
  INNER JOIN household_members hm ON hm.user_id = u.id
  INNER JOIN households h ON h.id = hm.household_id
  WHERE h.invite_code = 'THUIS' AND u.display_name = 'Ben'
);

INSERT INTO users (display_name)
SELECT 'Ineke'
WHERE NOT EXISTS (
  SELECT 1 FROM users u
  INNER JOIN household_members hm ON hm.user_id = u.id
  INNER JOIN households h ON h.id = hm.household_id
  WHERE h.invite_code = 'THUIS' AND u.display_name = 'Ineke'
);

INSERT INTO household_members (household_id, user_id, role)
SELECT h.id, u.id, 'member'
FROM households h
INNER JOIN users u ON u.display_name = 'Ben'
WHERE h.invite_code = 'THUIS'
  AND NOT EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = h.id AND hm.user_id = u.id
  );

INSERT INTO household_members (household_id, user_id, role)
SELECT h.id, u.id, 'member'
FROM households h
INNER JOIN users u ON u.display_name = 'Ineke'
WHERE h.invite_code = 'THUIS'
  AND NOT EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = h.id AND hm.user_id = u.id
  );
