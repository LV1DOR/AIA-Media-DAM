<?php
/** AIA F1-B extension. Native functions own all ResourceSpace writes. */

function api_aia_transfer_capabilities(): array
{
    return ['pluginVersion' => 1, 'uploadMax' => ini_get('upload_max_filesize'),
        'postMax' => ini_get('post_max_size'), 'sourceShareApi' => true];
}

function aia_transfer_error(string $message, int $status = 403): array
{
    http_response_code($status);
    return ['error' => $message];
}

function aia_transfer_eligible(int $ref): bool
{
    $resource = get_resource_data($ref);
    return $resource !== false
        && (int) $resource['archive'] === 0
        && (int) $resource['access'] === 0
        && get_resource_access($ref) === 0
        && can_share_resource($ref)
        && resource_download_allowed($ref, '', $resource['resource_type']);
}

function aia_transfer_owned_collection(int $collection): bool
{
    global $userref;
    $data = get_collection($collection);
    return $data !== false && (int) $data['user'] === (int) $userref
        && str_starts_with($data['name'], '[AIA Transfer] ')
        && collection_readable($collection) && collection_writeable($collection);
}

function api_aia_transfer_create(string $resources, string $title, string $expires, #[SensitiveParameter] string $password): array
{
    global $userref;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || is_anonymous_user() || checkperm('noex') || checkperm('b')) {
        return aia_transfer_error('Sharing is not permitted');
    }
    if (!preg_match('/^[1-9][0-9]*(,[1-9][0-9]*){0,99}$/D', $resources)) {
        return aia_transfer_error('Select 1 to 100 resources', 400);
    }
    $refs = array_values(array_unique(array_map('intval', explode(',', $resources))));
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $expires);
    if (!$date || $date->format('Y-m-d') !== $expires || $date < new DateTimeImmutable('today')
        || $date > new DateTimeImmutable('+30 days') || strlen($password) < 20 || strlen($password) > 128) {
        return aia_transfer_error('Invalid expiry or source password', 400);
    }
    foreach ($refs as $ref) {
        if (!aia_transfer_eligible($ref)) { return aia_transfer_error('A selected resource is not shareable'); }
    }
    $collection = create_collection($userref, '[AIA Transfer] ' . mb_substr(strip_tags($title), 0, 75));
    if (!$collection) { return aia_transfer_error('Collection creation failed', 502); }
    foreach ($refs as $ref) { add_resource_to_collection($ref, $collection); }
    if (count(get_collection_resources($collection)) !== count($refs)) {
        delete_collection($collection);
        return aia_transfer_error('Collection membership failed', 502);
    }
    $key = generate_collection_access_key($collection, 0, 'AIA Transfer', 0, $expires, '', $password);
    if (!$key) {
        delete_collection($collection);
        return aia_transfer_error('Native share creation failed', 502);
    }
    return ['collection' => $collection, 'accessKey' => $key, 'resources' => $refs,
        'expires' => $expires, 'expiryGranularity' => 'source end of calendar day', 'version' => 1];
}

function api_aia_transfer_manifest(int $collection, #[SensitiveParameter] string $access_key): array
{
    global $userref;
    if (!aia_transfer_owned_collection($collection)) { return aia_transfer_error('Share not available'); }
    $shares = get_external_shares(['share_collection' => $collection, 'access_key' => $access_key, 'share_user' => $userref]);
    if (count($shares) !== 1 || (int) $shares[0]['user'] !== (int) $userref
        || empty($shares[0]['expires']) || strtotime($shares[0]['expires']) < time()) {
        return aia_transfer_error('Share expired or revoked', 410);
    }
    $refs = get_collection_resources($collection);
    if (!$refs || count($refs) > 100) { return aia_transfer_error('Share not available', 410); }
    foreach ($refs as $ref) {
        if (!aia_transfer_eligible((int) $ref)) { return aia_transfer_error('A resource is no longer approved for sharing', 410); }
    }
    return ['resources' => array_map('intval', $refs), 'expires' => $shares[0]['expires'], 'active' => true];
}

function api_aia_transfer_download(int $collection, #[SensitiveParameter] string $access_key, int $resource): array
{
    global $baseurl;
    $manifest = api_aia_transfer_manifest($collection, $access_key);
    if (isset($manifest['error'])) { return $manifest; }
    if (!in_array($resource, $manifest['resources'], true)) { return aia_transfer_error('Resource is outside this share'); }
    $data = get_resource_data($resource);
    // Use the native external-share key, not a separate 24-hour staff capability.
    // The trusted adapter authenticates the source password and streams this URL.
    $url = generateURL($baseurl . '/pages/download.php', ['ref' => $resource,
        'k' => $access_key, 'ext' => $data['file_extension'], 'size' => '']);
    return ['url' => $url, 'extension' => $data['file_extension']];
}

function api_aia_transfer_revoke(int $collection, #[SensitiveParameter] string $access_key): array
{
    global $userref;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { return aia_transfer_error('POST required'); }
    if (get_collection($collection) === false) { return ['revoked' => true]; }
    if (!aia_transfer_owned_collection($collection)) {
        return aia_transfer_error('Share not available');
    }
    $shares = get_external_shares(['share_collection' => $collection, 'access_key' => $access_key, 'share_user' => $userref]);
    if (!$shares) { delete_collection($collection); return ['revoked' => true]; }
    if ((int) $shares[0]['user'] !== (int) $userref) { return aia_transfer_error('Share not available'); }
    delete_collection_access_key($collection, $access_key);
    delete_collection($collection);
    return ['revoked' => true];
}

function api_aia_staff_create(string $username, string $role, string $fullname): array
{
    global $aia_transfer_groups;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !checkPermission_manage_users()
        || !in_array($role, ['marketer', 'reviewer'], true)
        || !preg_match('/^aia_[a-zA-Z0-9._-]{3,40}$/D', $username)) {
        return aia_transfer_error('Staff provisioning is not permitted');
    }
    $group = (int) ($aia_transfer_groups[$role] ?? 0);
    $group_data = $group > 0 ? get_usergroup($group) : false;
    if (!$group_data || !str_starts_with($group_data['name'], 'AIA ')
        || array_intersect(explode(',', $group_data['permissions']), ['a','u','v','x','ex','exup'])) {
        return aia_transfer_error('Staff role configuration is not safe');
    }
    $ref = new_user($username, $group);
    if (!$ref || $ref < 1) { return aia_transfer_error('Source username already exists or user limit reached', 409); }
    $saved = save_user($ref, ['fullname' => mb_substr(strip_tags($fullname), 0, 80),
        'usergroup' => $group, 'approved' => 1]);
    if ($saved !== true) { return aia_transfer_error('Source account activation failed', 502); }
    return ['user' => $username, 'key' => get_api_key($ref), 'role' => $role];
}

function api_aia_staff_set_enabled(string $username, string $enabled): array
{
    global $aia_transfer_groups;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !checkPermission_manage_users()
        || !preg_match('/^aia_[a-zA-Z0-9._-]{3,40}$/D', $username) || !in_array($enabled, ['0', '1'], true)) {
        return aia_transfer_error('Staff administration is not permitted');
    }
    $ref = get_user_by_username($username);
    $data = $ref ? get_user($ref) : false;
    if (!$data || !in_array((int) $data['usergroup'], array_map('intval', array_values($aia_transfer_groups ?? [])), true)) {
        return aia_transfer_error('Account is outside the managed staff roles');
    }
    if (save_user($ref, ['approved' => $enabled === '1' ? 1 : 0]) !== true) {
        return aia_transfer_error('Source account update failed', 502);
    }
    return ['enabled' => $enabled === '1'];
}
