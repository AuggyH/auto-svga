#!/bin/zsh

export PATH=/usr/bin:/bin:/usr/sbin:/sbin
set -euo pipefail

readonly SCHEMA="aeb-ae26-isolated-panel-install-v0"
readonly LEGACY_NAME="local.auto-svga.aeb.panel.dev"
readonly TARGET_NAME="local.auto-svga.aeb.panel.ae26.dev"
readonly STAGING_NAME=".local.auto-svga.aeb.panel.ae26.dev.staging"
readonly BACKUP_NAME=".local.auto-svga.aeb.panel.ae26.dev.rollback"
readonly NODE_BIN="/Users/huangtengxin/.local/bin/node"
readonly EXPECTED_FILE_COUNT=5
readonly EXPECTED_DIRECTORY_COUNT=4

permit_id=""
source_identity=""
source_root=""
overlay_manifest=""
target_parent=""
evidence_root=""
staging_path=""
test_mode=0
test_process_state=""
test_fail_phase=""

fail() {
  print -u2 -- "AEB_AE26_INSTALL_FAIL|$1"
  exit 21
}

require_value() {
  [[ $# -ge 2 && -n "$2" ]] || fail "missing_value:$1"
}

while (( $# > 0 )); do
  case "$1" in
    --permit-id) require_value "$1" "${2:-}"; permit_id="$2"; shift 2 ;;
    --source-identity) require_value "$1" "${2:-}"; source_identity="$2"; shift 2 ;;
    --source-root) require_value "$1" "${2:-}"; source_root="$2"; shift 2 ;;
    --overlay-manifest) require_value "$1" "${2:-}"; overlay_manifest="$2"; shift 2 ;;
    --target-parent) require_value "$1" "${2:-}"; target_parent="$2"; shift 2 ;;
    --evidence-root) require_value "$1" "${2:-}"; evidence_root="$2"; shift 2 ;;
    --staging-path) require_value "$1" "${2:-}"; staging_path="$2"; shift 2 ;;
    --test-mode) test_mode=1; shift ;;
    --test-process-state) require_value "$1" "${2:-}"; test_process_state="$2"; shift 2 ;;
    --test-fail-phase) require_value "$1" "${2:-}"; test_fail_phase="$2"; shift 2 ;;
    *) fail "unknown_argument:$1" ;;
  esac
done

for value_name in permit_id source_identity source_root overlay_manifest target_parent evidence_root staging_path; do
  [[ -n "${(P)value_name}" ]] || fail "missing_argument:$value_name"
done

readonly LEGACY_PATH="$target_parent/$LEGACY_NAME"
readonly TARGET_PATH="$target_parent/$TARGET_NAME"
readonly RECEIPT_PATH="$evidence_root/reports/isolated-panel-install-report.json"
readonly OVERLAY_INDEX="${source_root:h}/plugin-panel-ae26-isolated/index.html"
readonly BACKUP_PATH="$target_parent/$BACKUP_NAME"

for utility in \
  /usr/bin/shasum /usr/bin/awk /usr/bin/find /usr/bin/wc /usr/bin/tr \
  /usr/bin/grep /usr/bin/id /usr/bin/sort /usr/bin/stat /bin/ps \
  /bin/mkdir /bin/cp /bin/mv /bin/chmod /bin/rm "$NODE_BIN"; do
  [[ -x "$utility" ]] || fail "bound_utility_unavailable:$utility"
done

for injected_path in "$source_root" "$overlay_manifest" "$target_parent" "$evidence_root" "$staging_path"; do
  [[ "$injected_path" == /* ]] || fail "path_not_absolute:$injected_path"
  [[ "$injected_path" != *'/../'* && "$injected_path" != */.. && "$injected_path" != *'/./'* ]] || \
    fail "path_not_normalized:$injected_path"
done

[[ "${staging_path:h}" == "$target_parent" && "${staging_path:t}" == "$STAGING_NAME" ]] || \
  fail "staging_path_not_bound"
[[ "$evidence_root" == /private/tmp/* ]] || fail "evidence_root_not_private_tmp"

if (( test_mode == 1 )); then
  [[ "$permit_id" == TEST-* ]] || fail "test_permit_id_required"
  for test_path in "$source_root" "$overlay_manifest" "$target_parent" "$evidence_root" "$staging_path"; do
    [[ "$test_path" == /private/tmp/* ]] || fail "test_path_not_private_tmp:$test_path"
  done
  [[ "$test_process_state" == "owner-ae25-only" || "$test_process_state" == "ae26-match" ]] || \
    fail "test_process_state_invalid"
  [[ -z "$test_fail_phase" || "$test_fail_phase" == "after-install" ]] || fail "test_fail_phase_invalid"
else
  [[ "$permit_id" == ASV-APR-* ]] || fail "real_permit_id_required"
  [[ "$target_parent" == "/Users/huangtengxin/Library/Application Support/Adobe/CEP/extensions" ]] || \
    fail "real_target_parent_not_bound"
  [[ -z "$test_process_state" && -z "$test_fail_phase" ]] || fail "test_injection_forbidden"
fi

assert_expected_directories() {
  local root="$1" count
  for directory in "$root" "$root/CSXS" "$root/js" "$root/jsx"; do
    [[ -d "$directory" && ! -L "$directory" ]] || fail "expected_directory_invalid:$directory"
  done
  count="$(/usr/bin/find "$root" -type d -print | /usr/bin/wc -l | /usr/bin/tr -d ' ')"
  [[ "$count" == "$EXPECTED_DIRECTORY_COUNT" ]] || fail "unexpected_directory_count:$root:$count"
}

assert_file() {
  local path="$1" expected_sha="$2" expected_bytes="$3" actual_sha actual_bytes
  [[ -f "$path" && ! -L "$path" ]] || fail "expected_file_invalid:$path"
  actual_sha="$(/usr/bin/shasum -a 256 "$path" | /usr/bin/awk '{print $1}')"
  actual_bytes="$(/usr/bin/wc -c < "$path" | /usr/bin/tr -d ' ')"
  [[ "$actual_sha" == "$expected_sha" ]] || fail "hash_mismatch:$path:$actual_sha"
  [[ "$actual_bytes" == "$expected_bytes" ]] || fail "size_mismatch:$path:$actual_bytes"
}

file_matches() {
  local path="$1" expected_sha="$2" expected_bytes="$3" actual_sha actual_bytes
  [[ -f "$path" && ! -L "$path" ]] || return 1
  actual_sha="$(/usr/bin/shasum -a 256 "$path" | /usr/bin/awk '{print $1}')"
  actual_bytes="$(/usr/bin/wc -c < "$path" | /usr/bin/tr -d ' ')"
  [[ "$actual_sha" == "$expected_sha" && "$actual_bytes" == "$expected_bytes" ]]
}

assert_exact_file_set() {
  local root="$1" count
  count="$(/usr/bin/find "$root" -type f -print | /usr/bin/wc -l | /usr/bin/tr -d ' ')"
  [[ "$count" == "$EXPECTED_FILE_COUNT" ]] || fail "unexpected_file_count:$root:$count"
  [[ -z "$(/usr/bin/find "$root" -type l -print)" ]] || fail "symlink_in_tree:$root"
}

assert_replaceable_target_set() {
  local root="$1" current_uid path
  current_uid="$(/usr/bin/id -u)"
  assert_expected_directories "$root"
  assert_exact_file_set "$root"
  for path in "$root" "$root/CSXS" "$root/js" "$root/jsx"; do
    [[ "$(/usr/bin/stat -f '%u' "$path")" == "$current_uid" ]] || fail "existing_target_owner_invalid:$path"
    [[ "$(/usr/bin/stat -f '%Lp' "$path")" == "755" ]] || fail "existing_target_mode_invalid:$path"
  done
  for path in \
    "$root/README.md" "$root/CSXS/manifest.xml" "$root/index.html" \
    "$root/js/aeb-panel.js" "$root/jsx/aeb-export-to-auto-svga.jsx"; do
    [[ "$(/usr/bin/stat -f '%u' "$path")" == "$current_uid" ]] || fail "existing_target_owner_invalid:$path"
    [[ "$(/usr/bin/stat -f '%Lp' "$path")" == "644" ]] || fail "existing_target_mode_invalid:$path"
    [[ "$(/usr/bin/stat -f '%l' "$path")" == "1" ]] || fail "existing_target_link_count_invalid:$path"
  done
}

assert_source_set() {
  local root="$1"
  assert_expected_directories "$root"
  assert_exact_file_set "$root"
  assert_file "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436"
  assert_file "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339"
  assert_file "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508"
  assert_file "$root/js/aeb-panel.js" "c9fbe9cf8ed0a8ca6a5b2b1444e59c63e782b65d253e16ee7c41d9b8ef3e10ab" "11263"
  assert_file "$root/jsx/aeb-export-to-auto-svga.jsx" "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048" "57045"
}

assert_target_set() {
  local root="$1"
  assert_expected_directories "$root"
  assert_exact_file_set "$root"
  assert_file "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436"
  assert_file "$root/CSXS/manifest.xml" "0fe5ea0b77465b1f09c8db8e1a4c454f428e2fc41b51db5c1cd17c644296cc53" "1368"
  assert_file "$root/index.html" "f0d5b8ff2c2aac41a175ac069e9220f5b13b48c3753f6fac8c4a17efe446ddbd" "1771"
  assert_file "$root/js/aeb-panel.js" "c9fbe9cf8ed0a8ca6a5b2b1444e59c63e782b65d253e16ee7c41d9b8ef3e10ab" "11263"
  assert_file "$root/jsx/aeb-export-to-auto-svga.jsx" "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048" "57045"
}

target_matches_expected() {
  local root="$1"
  file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "0fe5ea0b77465b1f09c8db8e1a4c454f428e2fc41b51db5c1cd17c644296cc53" "1368" && \
    file_matches "$root/index.html" "f0d5b8ff2c2aac41a175ac069e9220f5b13b48c3753f6fac8c4a17efe446ddbd" "1771" && \
    file_matches "$root/js/aeb-panel.js" "c9fbe9cf8ed0a8ca6a5b2b1444e59c63e782b65d253e16ee7c41d9b8ef3e10ab" "11263" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048" "57045"
}

assert_legacy_set_real() {
  local root="$1"
  assert_expected_directories "$root"
  assert_exact_file_set "$root"
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "c9fbe9cf8ed0a8ca6a5b2b1444e59c63e782b65d253e16ee7c41d9b8ef3e10ab" "11263" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048" "57045"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "457e849b5ab293593ca2c61904783b960e01699e4569c120e15f533ffa2d589d" "10625" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "a45ecdb35599bac740e596ace02d6492e7cca0e7e6baa63df641c544ae81b048" "57045"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "80f85804cf9efcade2b0dfeab7bd1a34b7e37d3993d67a5fdb67b71f82b2dc59" "10219" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "58fdc5667d0133e0d0be37006d82546b2a35acc415c3c2b1c8700b0efebc1670" "56765"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "f938c41a0e005ed792213302e6aadfca5becf94409bc190c6e7c38a47316ca6e" "9500" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "16eb959bde441fb84cde7d3516fa3075b154f719b09c6cdc57bd3a6f3ee7430b" "57412"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "a031502b9609bc6d0e0621ec767205d6d8b7515d02e9b13c289122ec8438e66f" "8734" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "16eb959bde441fb84cde7d3516fa3075b154f719b09c6cdc57bd3a6f3ee7430b" "57412"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "559a0d4833c1a64250741bebd046396f42357b255c4ecc3a851bbd304e1695e5" "2436" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "cc3b8c4d0a8883c0dd7da5abaa54ca8a219193e80efa6676b783463bcde23ddf" "6786" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "16eb959bde441fb84cde7d3516fa3075b154f719b09c6cdc57bd3a6f3ee7430b" "57412"; then
    return 0
  fi
  if \
    file_matches "$root/README.md" "7891a0a3f992fcc89a3a8aef8f65d63eeb18828b260ee03b924ea5278846fb2d" "1557" && \
    file_matches "$root/CSXS/manifest.xml" "cfc5f084a304c5c7c09488c355109e0195f5414de79401c802ba2c039c90e1e6" "1339" && \
    file_matches "$root/index.html" "3d77e14d69d3b1a7f59a78394f6f45cb7d19223dd44e94c9605cf4de83d40747" "1508" && \
    file_matches "$root/js/aeb-panel.js" "f20239f626baf193882eedb3cedd149185534c203da73d5ede665de1c7347775" "3793" && \
    file_matches "$root/jsx/aeb-export-to-auto-svga.jsx" "e160e5ac64a326dbe4c10eb83d513adc2a677b42ec6602b24ba9701e08323683" "38003"; then
    return 0
  fi
  fail "legacy_target_unknown_baseline:$root"
}

tree_digest() {
  local root="$1"
  /usr/bin/find "$root" -type f -print | while IFS= read -r file; do
    print -r -- "${file#$root/} $(/usr/bin/shasum -a 256 "$file" | /usr/bin/awk '{print $1}')"
  done | LC_ALL=C /usr/bin/sort | /usr/bin/shasum -a 256 | /usr/bin/awk '{print $1}'
}

assert_siblings() {
  local phase="$1" expected_count="$2" count=0 entry
  while IFS= read -r entry; do
    case "$phase" in
      pre|post)
        [[ "$entry" == "$LEGACY_PATH" || "$entry" == "$TARGET_PATH" ]] || \
          fail "unexpected_auto_svga_sibling:$phase:$entry"
        ;;
      transaction)
        [[ "$entry" == "$LEGACY_PATH" || "$entry" == "$TARGET_PATH" || "$entry" == "$BACKUP_PATH" ]] || \
          fail "unexpected_auto_svga_sibling:$phase:$entry"
        ;;
      *) fail "invalid_sibling_phase:$phase" ;;
    esac
    count=$((count + 1))
  done < <(/usr/bin/find "$target_parent" -maxdepth 1 -iname '*auto-svga*' -print)
  [[ "$count" == "$expected_count" ]] || fail "auto_svga_sibling_count:$phase:$count"
}

assert_source_set "$source_root"
assert_file "$overlay_manifest" "0fe5ea0b77465b1f09c8db8e1a4c454f428e2fc41b51db5c1cd17c644296cc53" "1368"
assert_file "$OVERLAY_INDEX" "f0d5b8ff2c2aac41a175ac069e9220f5b13b48c3753f6fac8c4a17efe446ddbd" "1771"
[[ -d "$target_parent" && ! -L "$target_parent" ]] || fail "target_parent_invalid"
[[ -d "$LEGACY_PATH" && ! -L "$LEGACY_PATH" ]] || fail "legacy_target_invalid"
assert_legacy_set_real "$LEGACY_PATH"
readonly LEGACY_DIGEST_BEFORE="$(tree_digest "$LEGACY_PATH")"
previous_target_present=0
previous_target_digest=""
if [[ -L "$TARGET_PATH" ]]; then
  fail "isolated_target_symlink"
elif [[ -e "$TARGET_PATH" ]]; then
  [[ -d "$TARGET_PATH" ]] || fail "isolated_target_invalid"
  assert_replaceable_target_set "$TARGET_PATH"
  previous_target_present=1
  previous_target_digest="$(tree_digest "$TARGET_PATH")"
fi
assert_siblings pre "$((1 + previous_target_present))"
[[ ! -e "$staging_path" && ! -L "$staging_path" ]] || fail "staging_already_exists"
[[ ! -e "$BACKUP_PATH" && ! -L "$BACKUP_PATH" ]] || fail "rollback_path_already_exists"
[[ ! -e "$evidence_root" && ! -L "$evidence_root" ]] || fail "evidence_already_exists"

if (( test_mode == 1 )); then
  [[ "$test_process_state" == "owner-ae25-only" ]] || fail "ae26_process_match_injected"
  process_status="test_owner_ae25_only"
else
  set +e
  process_output="$(/bin/ps -axo pid=,ppid=,command= 2>&1)"
  process_rc=$?
  set -e
  [[ $process_rc -eq 0 ]] || fail "ps_inconclusive:$process_rc"
  process_match="$(print -r -- "$process_output" | /usr/bin/awk -v self="$$" -v parent="$PPID" '
    $1 == self || $1 == parent { next }
    index($0, "/Applications/Adobe After Effects 2026/") ||
    index($0, "AEFT 26.3") ||
    index($0, "local.auto-svga.aeb.panel.ae26.dev") { print; exit 0 }
  ')"
  [[ -z "$process_match" ]] || fail "ae26_process_match"
  process_status="ae26_absent_owner_ae25_allowed"
fi

rollback_active=1
installed=0
backup_active=0
install_action="created_target"
replacement_performed=0
target_identity_preserved=0
rollback_on_exit() {
  local rc=$? restored="not_applicable" absent="no"
  trap - EXIT
  if [[ $rc -ne 0 && $rollback_active -eq 1 ]]; then
    set +e
    [[ $installed -eq 1 && -d "$TARGET_PATH" && ! -L "$TARGET_PATH" ]] && /bin/rm -rf "$TARGET_PATH"
    if [[ $backup_active -eq 1 && -d "$BACKUP_PATH" && ! -L "$BACKUP_PATH" ]]; then
      /bin/mv "$BACKUP_PATH" "$TARGET_PATH"
    fi
    [[ -d "$staging_path" && ! -L "$staging_path" ]] && /bin/rm -rf "$staging_path"
    [[ -d "$evidence_root" && ! -L "$evidence_root" ]] && /bin/rm -rf "$evidence_root"
    if [[ $previous_target_present -eq 1 ]]; then
      restored="$([[ -d "$TARGET_PATH" && ! -L "$TARGET_PATH" && "$(tree_digest "$TARGET_PATH")" == "$previous_target_digest" ]] && print yes || print no)"
    fi
    absent="$([[ ! -e "$TARGET_PATH" && ! -L "$TARGET_PATH" ]] && print yes || print no)"
    print -u2 -- "AEB_AE26_INSTALL_ROLLBACK|isolated_target_restored=$restored|isolated_target_absent=$absent"
  fi
}
trap rollback_on_exit EXIT

if [[ $previous_target_present -eq 1 ]] && target_matches_expected "$TARGET_PATH"; then
  install_action="preserved_matching_target"
  target_identity_preserved=1
  assert_target_set "$TARGET_PATH"
  assert_siblings post 2
else
  /bin/mkdir "$staging_path"
  /bin/mkdir "$staging_path/CSXS" "$staging_path/js" "$staging_path/jsx"
  /bin/cp "$source_root/README.md" "$staging_path/README.md"
  /bin/cp "$overlay_manifest" "$staging_path/CSXS/manifest.xml"
  /bin/cp "$OVERLAY_INDEX" "$staging_path/index.html"
  /bin/cp "$source_root/js/aeb-panel.js" "$staging_path/js/aeb-panel.js"
  /bin/cp "$source_root/jsx/aeb-export-to-auto-svga.jsx" "$staging_path/jsx/aeb-export-to-auto-svga.jsx"
  /bin/chmod 755 "$staging_path" "$staging_path/CSXS" "$staging_path/js" "$staging_path/jsx"
  /bin/chmod 644 "$staging_path/README.md" "$staging_path/CSXS/manifest.xml" \
    "$staging_path/index.html" "$staging_path/js/aeb-panel.js" "$staging_path/jsx/aeb-export-to-auto-svga.jsx"
  assert_target_set "$staging_path"

  if [[ $previous_target_present -eq 1 ]]; then
    install_action="replaced_target"
    replacement_performed=1
    /bin/mv "$TARGET_PATH" "$BACKUP_PATH"
    backup_active=1
  fi
  /bin/mv "$staging_path" "$TARGET_PATH"
  installed=1
  assert_target_set "$TARGET_PATH"
  if [[ $previous_target_present -eq 1 ]]; then
    assert_siblings transaction 3
    [[ "$(tree_digest "$BACKUP_PATH")" == "$previous_target_digest" ]] || fail "rollback_tree_changed"
  else
    assert_siblings post 2
  fi
fi
[[ "$test_fail_phase" != "after-install" ]] || fail "injected_failure_after_install"
[[ "$(tree_digest "$LEGACY_PATH")" == "$LEGACY_DIGEST_BEFORE" ]] || fail "legacy_target_changed"

/bin/mkdir -p "$evidence_root/reports"
export AEB_AE26_RECEIPT="$RECEIPT_PATH"
export AEB_AE26_SCHEMA="$SCHEMA"
export AEB_AE26_PERMIT_ID="$permit_id"
export AEB_AE26_SOURCE_IDENTITY="$source_identity"
export AEB_AE26_LEGACY_PATH="$LEGACY_PATH"
export AEB_AE26_TARGET_PATH="$TARGET_PATH"
export AEB_AE26_LEGACY_DIGEST="$LEGACY_DIGEST_BEFORE"
export AEB_AE26_PROCESS_STATUS="$process_status"
export AEB_AE26_PREVIOUS_TARGET_PRESENT="$previous_target_present"
export AEB_AE26_INSTALL_ACTION="$install_action"
export AEB_AE26_REPLACEMENT_PERFORMED="$replacement_performed"
export AEB_AE26_TARGET_IDENTITY_PRESERVED="$target_identity_preserved"
"$NODE_BIN" -e '
  const fs = require("node:fs");
  const receipt = {
    schemaVersion: process.env.AEB_AE26_SCHEMA,
    status: "pass",
    permitId: process.env.AEB_AE26_PERMIT_ID,
    sourceIdentity: process.env.AEB_AE26_SOURCE_IDENTITY,
    legacyPanel: { path: process.env.AEB_AE26_LEGACY_PATH, unchangedDigest: process.env.AEB_AE26_LEGACY_DIGEST },
    isolatedPanel: {
      path: process.env.AEB_AE26_TARGET_PATH,
      installed: true,
      previousTargetPresent: process.env.AEB_AE26_PREVIOUS_TARGET_PRESENT === "1",
      replacementPerformed: process.env.AEB_AE26_REPLACEMENT_PERFORMED === "1",
      targetIdentityPreserved: process.env.AEB_AE26_TARGET_IDENTITY_PRESERVED === "1",
      installAction: process.env.AEB_AE26_INSTALL_ACTION,
      stagingAbsent: true
    },
    processPreflight: { status: process.env.AEB_AE26_PROCESS_STATUS, ae26Absent: true },
    boundaries: { legacyPanelMutationExecuted: false, aeLaunched: false, foregroundControlUsed: false }
  };
  fs.writeFileSync(process.env.AEB_AE26_RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
'

[[ -f "$RECEIPT_PATH" && ! -L "$RECEIPT_PATH" ]] || fail "receipt_missing"
assert_target_set "$TARGET_PATH"
[[ "$(tree_digest "$LEGACY_PATH")" == "$LEGACY_DIGEST_BEFORE" ]] || fail "legacy_target_changed_postreceipt"
[[ ! -e "$staging_path" && ! -L "$staging_path" ]] || fail "staging_remains"
if [[ $backup_active -eq 1 ]]; then
  /bin/rm -rf "$BACKUP_PATH"
  backup_active=0
fi
[[ ! -e "$BACKUP_PATH" && ! -L "$BACKUP_PATH" ]] || fail "rollback_path_remains"
rollback_active=0
trap - EXIT
assert_siblings post 2
print -- "AEB_AE26_ISOLATED_INSTALL_SUCCESS"
