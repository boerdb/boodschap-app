<?php
declare(strict_types=1);

function json_out(mixed $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        return trim($m[1]);
    }
    return null;
}

function require_session(PDO $pdo): array
{
    $token = bearer_token();
    if (!$token) {
        json_out(['error' => 'Niet ingelogd'], 401);
    }
    $stmt = $pdo->prepare(
        'SELECT s.user_id, s.household_id, u.display_name, h.name AS household_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN households h ON h.id = s.household_id
         WHERE s.token = ? AND s.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        json_out(['error' => 'Sessie verlopen'], 401);
    }
    return $row;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = preg_replace('#^/api/boodschap#', '', $path) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && $path === '/auth/login') {
    $body = read_json();
    $name = trim((string) ($body['displayName'] ?? ''));
    $code = strtoupper(trim((string) ($body['inviteCode'] ?? '')));
    if ($name === '' || $code === '') {
        json_out(['error' => 'Naam en code zijn verplicht'], 400);
    }
    $stmt = $pdo->prepare('SELECT id, name FROM households WHERE invite_code = ?');
    $stmt->execute([$code]);
    $household = $stmt->fetch();
    if (!$household) {
        json_out(['error' => 'Onbekende huishoudcode'], 404);
    }
    $stmt = $pdo->prepare(
        'SELECT u.id, u.display_name FROM users u
         INNER JOIN household_members hm ON hm.user_id = u.id
         WHERE hm.household_id = ? AND u.display_name = ?
         LIMIT 1'
    );
    $stmt->execute([(int) $household['id'], $name]);
    $user = $stmt->fetch();
    if (!$user) {
        json_out(['error' => 'Onbekende gebruiker voor dit huishouden'], 403);
    }
    $userId = (int) $user['id'];
    $name = $user['display_name'];
    $token = bin2hex(random_bytes(32));
    $pdo->prepare(
        'INSERT INTO sessions (token, user_id, household_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 90 DAY))'
    )->execute([$token, $userId, (int) $household['id']]);
    json_out([
        'token' => $token,
        'userId' => $userId,
        'displayName' => $name,
        'householdId' => (int) $household['id'],
        'householdName' => $household['name'],
    ]);
}

if ($method === 'GET' && $path === '/auth/me') {
    $session = require_session($pdo);
    json_out([
        'userId' => (int) $session['user_id'],
        'displayName' => $session['display_name'],
        'householdId' => (int) $session['household_id'],
        'householdName' => $session['household_name'],
    ]);
}

if ($method === 'GET' && preg_match('#^/lists/(\d+)/items$#', $path, $m)) {
    $session = require_session($pdo);
    $householdId = (int) $m[1];
    if ($householdId !== (int) $session['household_id']) {
        json_out(['error' => 'Geen toegang'], 403);
    }
    $since = $_GET['updated_since'] ?? null;
    $sql = 'SELECT id, barcode, name, quantity, checked, added_by AS addedBy,
                   UNIX_TIMESTAMP(updated_at) AS updatedAt
            FROM list_items WHERE household_id = ?';
    $params = [$householdId];
    if ($since !== null && $since !== '') {
        $sql .= ' AND updated_at > FROM_UNIXTIME(?)';
        $params[] = (int) $since;
    }
    $sql .= ' ORDER BY checked ASC, updated_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_out(['items' => $stmt->fetchAll()]);
}

if ($method === 'POST' && preg_match('#^/lists/(\d+)/items$#', $path, $m)) {
    $session = require_session($pdo);
    $householdId = (int) $m[1];
    if ($householdId !== (int) $session['household_id']) {
        json_out(['error' => 'Geen toegang'], 403);
    }
    $body = read_json();
    $name = trim((string) ($body['name'] ?? ''));
    if ($name === '') {
        json_out(['error' => 'Naam is verplicht'], 400);
    }
    $barcode = isset($body['barcode']) ? trim((string) $body['barcode']) : null;
    $quantity = (float) ($body['quantity'] ?? 1);
    $stmt = $pdo->prepare(
        'INSERT INTO list_items (household_id, barcode, name, quantity, added_by)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $householdId,
        $barcode !== '' ? $barcode : null,
        $name,
        $quantity > 0 ? $quantity : 1,
        (int) $session['user_id'],
    ]);
    $id = (int) $pdo->lastInsertId();
    json_out(['item' => [
        'id' => $id,
        'barcode' => $barcode,
        'name' => $name,
        'quantity' => $quantity,
        'checked' => false,
        'addedBy' => (int) $session['user_id'],
        'updatedAt' => time(),
    ]], 201);
}

if ($method === 'PATCH' && preg_match('#^/items/(\d+)$#', $path, $m)) {
    $session = require_session($pdo);
    $itemId = (int) $m[1];
    $body = read_json();
    $stmt = $pdo->prepare(
        'SELECT id, household_id FROM list_items WHERE id = ?'
    );
    $stmt->execute([$itemId]);
    $item = $stmt->fetch();
    if (!$item || (int) $item['household_id'] !== (int) $session['household_id']) {
        json_out(['error' => 'Item niet gevonden'], 404);
    }
    $fields = [];
    $params = [];
    if (array_key_exists('checked', $body)) {
        $fields[] = 'checked = ?';
        $params[] = !empty($body['checked']) ? 1 : 0;
    }
    if (array_key_exists('quantity', $body)) {
        $fields[] = 'quantity = ?';
        $params[] = max(0.01, (float) $body['quantity']);
    }
    if (array_key_exists('name', $body)) {
        $fields[] = 'name = ?';
        $params[] = trim((string) $body['name']);
    }
    if ($fields === []) {
        json_out(['error' => 'Geen wijzigingen'], 400);
    }
    $params[] = $itemId;
    $pdo->prepare('UPDATE list_items SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    json_out(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/items/(\d+)$#', $path, $m)) {
    $session = require_session($pdo);
    $itemId = (int) $m[1];
    $stmt = $pdo->prepare('DELETE FROM list_items WHERE id = ? AND household_id = ?');
    $stmt->execute([$itemId, (int) $session['household_id']]);
    if ($stmt->rowCount() === 0) {
        json_out(['error' => 'Item niet gevonden'], 404);
    }
    json_out(['ok' => true]);
}

json_out(['error' => 'Route niet gevonden'], 404);
