#!/bin/sh
set -eu

DEPLOY_APP_DIR=${DEPLOY_APP_DIR:-$(pwd)}
DEPLOY_REF=${DEPLOY_REF:-main}
DEPLOY_ENV_FILE=${DEPLOY_ENV_FILE:-.env.docker}
APP_IMAGE=${APP_IMAGE:?APP_IMAGE is required}
GHCR_USERNAME=${GHCR_USERNAME:?GHCR_USERNAME is required}
GHCR_TOKEN=${GHCR_TOKEN:?GHCR_TOKEN is required}
DEPLOY_SMOKE_MAX_ATTEMPTS=${DEPLOY_SMOKE_MAX_ATTEMPTS:-24}
DEPLOY_SMOKE_WAIT_SECONDS=${DEPLOY_SMOKE_WAIT_SECONDS:-5}
DEPLOY_REPORT_ROOT=${DEPLOY_REPORT_ROOT:-.deploy-reports}
DEPLOY_LOG_TAIL_LINES=${DEPLOY_LOG_TAIL_LINES:-120}

cd "$DEPLOY_APP_DIR"

now_utc() {
  if date -u '+%Y-%m-%dT%H:%M:%SZ' >/dev/null 2>&1; then
    date -u '+%Y-%m-%dT%H:%M:%SZ'
    return
  fi

  date
}

deploy_stamp() {
  if date -u '+%Y%m%dT%H%M%SZ' >/dev/null 2>&1; then
    date -u '+%Y%m%dT%H%M%SZ'
    return
  fi

  date '+%Y%m%dT%H%M%S'
}

json_escape() {
  printf '%s' "$1" | sed ':a;N;$!ba;s/\\/\\\\/g;s/"/\\"/g;s/\r/\\r/g;s/\n/\\n/g'
}

bool_literal() {
  if [ "$1" = "1" ]; then
    printf 'true'
    return
  fi

  printf 'false'
}

log_deploy() {
  printf '[deploy] %s\n' "$1"
}

read_app_image_from_env_file() {
  target_env_file=$1

  if [ ! -f "$target_env_file" ]; then
    return 0
  fi

  sed -n 's/^APP_IMAGE=//p' "$target_env_file" | tail -n 1
}

PREVIOUS_COMMIT=$(git rev-parse HEAD)
PREVIOUS_APP_IMAGE=$(read_app_image_from_env_file "$DEPLOY_ENV_FILE")
ENV_FILE_BACKUP=$(mktemp)
ENV_FILE_EXISTED=0
TMP_ENV_UPDATE_FILE=

if [ -f "$DEPLOY_ENV_FILE" ]; then
  cp "$DEPLOY_ENV_FILE" "$ENV_FILE_BACKUP"
  ENV_FILE_EXISTED=1
fi

DEPLOY_ID="$(deploy_stamp)-$$"
DEPLOY_STARTED_AT=$(now_utc)
DEPLOY_FINISHED_AT=
REPORT_DIR_RELATIVE="${DEPLOY_REPORT_ROOT}/${DEPLOY_ID}"
REPORT_DIR_ABSOLUTE="${DEPLOY_APP_DIR}/${REPORT_DIR_RELATIVE}"
LATEST_REPORT_DIR_RELATIVE="${DEPLOY_REPORT_ROOT}/latest"
LATEST_REPORT_DIR_ABSOLUTE="${DEPLOY_APP_DIR}/${LATEST_REPORT_DIR_RELATIVE}"

mkdir -p "$REPORT_DIR_ABSOLUTE"

DEPLOY_STATUS="running"
DEPLOY_MESSAGE=""
DEPLOYED_COMMIT=""
FINAL_COMMIT="$PREVIOUS_COMMIT"
ROLLBACK_TRIGGERED=0
ROLLBACK_STATUS="not_needed"
ROLLBACK_MESSAGE=""
DEPLOY_SMOKE_STATUS="not_started"
DEPLOY_SMOKE_ATTEMPTS=0
DEPLOY_SMOKE_BASE_URL=""
ROLLBACK_SMOKE_STATUS="not_started"
ROLLBACK_SMOKE_ATTEMPTS=0
ROLLBACK_SMOKE_BASE_URL=""
FINAL_APP_IMAGE="$APP_IMAGE"
FINAL_STACK_STATUS_LABEL="post-deploy"

cleanup_temp_files() {
  rm -f "$ENV_FILE_BACKUP"
  if [ -n "$TMP_ENV_UPDATE_FILE" ]; then
    rm -f "$TMP_ENV_UPDATE_FILE"
  fi
}

copy_report_to_latest() {
  rm -rf "$LATEST_REPORT_DIR_ABSOLUTE"
  mkdir -p "$DEPLOY_REPORT_ROOT"
  cp -R "$REPORT_DIR_ABSOLUTE" "$LATEST_REPORT_DIR_ABSOLUTE"
}

write_report_files() {
  summary_json_path="${REPORT_DIR_ABSOLUTE}/summary.json"
  summary_md_path="${REPORT_DIR_ABSOLUTE}/summary.md"
  final_ps_path="${REPORT_DIR_RELATIVE}/${FINAL_STACK_STATUS_LABEL}-docker-compose-ps.txt"
  final_logs_path="${REPORT_DIR_RELATIVE}/${FINAL_STACK_STATUS_LABEL}-app-logs.txt"
  deploy_attempt_log_path="${REPORT_DIR_RELATIVE}/deploy-smoke-attempts.log"
  deploy_health_path="${REPORT_DIR_RELATIVE}/deploy-health-last.txt"
  deploy_login_path="${REPORT_DIR_RELATIVE}/deploy-login-last.txt"
  rollback_attempt_log_path="${REPORT_DIR_RELATIVE}/rollback-smoke-attempts.log"
  rollback_health_path="${REPORT_DIR_RELATIVE}/rollback-health-last.txt"
  rollback_login_path="${REPORT_DIR_RELATIVE}/rollback-login-last.txt"

  cat > "$summary_json_path" <<EOF
{
  "deployId": "$(json_escape "$DEPLOY_ID")",
  "startedAt": "$(json_escape "$DEPLOY_STARTED_AT")",
  "finishedAt": "$(json_escape "$DEPLOY_FINISHED_AT")",
  "deployRef": "$(json_escape "$DEPLOY_REF")",
  "deployEnvFile": "$(json_escape "$DEPLOY_ENV_FILE")",
  "status": "$(json_escape "$DEPLOY_STATUS")",
  "message": "$(json_escape "$DEPLOY_MESSAGE")",
  "previousCommit": "$(json_escape "$PREVIOUS_COMMIT")",
  "deployedCommit": "$(json_escape "$DEPLOYED_COMMIT")",
  "finalCommit": "$(json_escape "$FINAL_COMMIT")",
  "requestedAppImage": "$(json_escape "$APP_IMAGE")",
  "previousAppImage": "$(json_escape "$PREVIOUS_APP_IMAGE")",
  "finalAppImage": "$(json_escape "$FINAL_APP_IMAGE")",
  "rollbackTriggered": $(bool_literal "$ROLLBACK_TRIGGERED"),
  "rollbackStatus": "$(json_escape "$ROLLBACK_STATUS")",
  "rollbackMessage": "$(json_escape "$ROLLBACK_MESSAGE")",
  "deploySmoke": {
    "status": "$(json_escape "$DEPLOY_SMOKE_STATUS")",
    "attempts": $DEPLOY_SMOKE_ATTEMPTS,
    "baseUrl": "$(json_escape "$DEPLOY_SMOKE_BASE_URL")",
    "attemptLogPath": "$(json_escape "$deploy_attempt_log_path")",
    "healthBodyPath": "$(json_escape "$deploy_health_path")",
    "loginBodyPath": "$(json_escape "$deploy_login_path")"
  },
  "rollbackSmoke": {
    "status": "$(json_escape "$ROLLBACK_SMOKE_STATUS")",
    "attempts": $ROLLBACK_SMOKE_ATTEMPTS,
    "baseUrl": "$(json_escape "$ROLLBACK_SMOKE_BASE_URL")",
    "attemptLogPath": "$(json_escape "$rollback_attempt_log_path")",
    "healthBodyPath": "$(json_escape "$rollback_health_path")",
    "loginBodyPath": "$(json_escape "$rollback_login_path")"
  },
  "finalDiagnostics": {
    "label": "$(json_escape "$FINAL_STACK_STATUS_LABEL")",
    "composePsPath": "$(json_escape "$final_ps_path")",
    "appLogsPath": "$(json_escape "$final_logs_path")"
  }
}
EOF

  cat > "$summary_md_path" <<EOF
# 远端部署报告

- 部署 ID：\`$DEPLOY_ID\`
- 开始时间：\`$DEPLOY_STARTED_AT\`
- 结束时间：\`$DEPLOY_FINISHED_AT\`
- 部署目标：\`$DEPLOY_REF\`
- 环境文件：\`$DEPLOY_ENV_FILE\`
- 最终状态：\`$DEPLOY_STATUS\`
- 状态说明：$DEPLOY_MESSAGE
- 部署前 commit：\`$PREVIOUS_COMMIT\`
- 目标 commit：\`$DEPLOYED_COMMIT\`
- 最终 commit：\`$FINAL_COMMIT\`
- 请求镜像：\`$APP_IMAGE\`
- 部署前镜像：\`${PREVIOUS_APP_IMAGE:-_empty_}\`
- 最终镜像：\`${FINAL_APP_IMAGE:-_empty_}\`

## Smoke

- 首次部署 smoke：\`$DEPLOY_SMOKE_STATUS\`，尝试 \`$DEPLOY_SMOKE_ATTEMPTS\` 次，基地址 \`${DEPLOY_SMOKE_BASE_URL:-_unknown_}\`
- 回滚是否触发：\`$(bool_literal "$ROLLBACK_TRIGGERED")\`
- 回滚状态：\`$ROLLBACK_STATUS\`
- 回滚说明：${ROLLBACK_MESSAGE:-_none_}
- 回滚 smoke：\`$ROLLBACK_SMOKE_STATUS\`，尝试 \`$ROLLBACK_SMOKE_ATTEMPTS\` 次，基地址 \`${ROLLBACK_SMOKE_BASE_URL:-_unknown_}\`

## 远端留档

- 首次部署 smoke 尝试日志：\`$deploy_attempt_log_path\`
- 首次部署 health 响应：\`$deploy_health_path\`
- 首次部署 login 响应：\`$deploy_login_path\`
- 回滚 smoke 尝试日志：\`$rollback_attempt_log_path\`
- 回滚 health 响应：\`$rollback_health_path\`
- 回滚 login 响应：\`$rollback_login_path\`
- 最终 compose 状态：\`$final_ps_path\`
- 最终 app 日志：\`$final_logs_path\`
EOF

  copy_report_to_latest
  log_deploy "Deploy report saved to ${REPORT_DIR_ABSOLUTE}"
  printf 'DEPLOY_REPORT_DIR_RELATIVE=%s\n' "$REPORT_DIR_RELATIVE"
  printf 'DEPLOY_REPORT_DIR_ABSOLUTE=%s\n' "$REPORT_DIR_ABSOLUTE"
  printf 'DEPLOY_REPORT_LATEST_RELATIVE=%s\n' "$LATEST_REPORT_DIR_RELATIVE"
  printf 'DEPLOY_REPORT_LATEST_ABSOLUTE=%s\n' "$LATEST_REPORT_DIR_ABSOLUTE"
}

finalize() {
  exit_code=$?
  DEPLOY_FINISHED_AT=$(now_utc)

  if [ "$DEPLOY_STATUS" = "running" ]; then
    if [ "$exit_code" -eq 0 ]; then
      DEPLOY_STATUS="succeeded"
      DEPLOY_MESSAGE="Deployment completed successfully."
    else
      DEPLOY_STATUS="failed"
      DEPLOY_MESSAGE="Deployment exited before a final status was recorded."
    fi
  fi

  FINAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || printf '%s' "$FINAL_COMMIT")
  write_report_files
  cleanup_temp_files
  exit "$exit_code"
}

trap finalize EXIT

fetch_url_to_file() {
  target_url=$1
  target_file=$2

  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$target_url" > "$target_file"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- "$target_url" > "$target_file"
    return
  fi

  echo "[deploy] Neither curl nor wget is available for smoke checks." >&2
  return 127
}

restore_env_file() {
  if [ "$ENV_FILE_EXISTED" -eq 1 ]; then
    cp "$ENV_FILE_BACKUP" "$DEPLOY_ENV_FILE"
  else
    rm -f "$DEPLOY_ENV_FILE"
  fi
}

resolve_env_app_image() {
  read_app_image_from_env_file "$DEPLOY_ENV_FILE"
}

compose_with_current_image() {
  compose_image=$(resolve_env_app_image)
  if [ -n "$compose_image" ]; then
    APP_IMAGE="$compose_image" docker compose --env-file "$DEPLOY_ENV_FILE" "$@"
    return
  fi

  APP_IMAGE="$APP_IMAGE" docker compose --env-file "$DEPLOY_ENV_FILE" "$@"
}

resolve_app_port() {
  port_line=$(compose_with_current_image port app 3000 2>/dev/null | tail -n 1 || true)
  if [ -n "$port_line" ]; then
    printf '%s\n' "${port_line##*:}"
    return
  fi

  printf '3000\n'
}

capture_runtime_diagnostics() {
  label=$1
  compose_with_current_image ps > "${REPORT_DIR_ABSOLUTE}/${label}-docker-compose-ps.txt" 2>&1 || true
  compose_with_current_image logs app --tail "$DEPLOY_LOG_TAIL_LINES" > "${REPORT_DIR_ABSOLUTE}/${label}-app-logs.txt" 2>&1 || true
  FINAL_STACK_STATUS_LABEL=$label
}

update_smoke_status() {
  stage=$1
  status=$2
  attempts=$3
  base_url=$4

  if [ "$stage" = "deploy" ]; then
    DEPLOY_SMOKE_STATUS=$status
    DEPLOY_SMOKE_ATTEMPTS=$attempts
    DEPLOY_SMOKE_BASE_URL=$base_url
    return
  fi

  ROLLBACK_SMOKE_STATUS=$status
  ROLLBACK_SMOKE_ATTEMPTS=$attempts
  ROLLBACK_SMOKE_BASE_URL=$base_url
}

run_post_deploy_smoke() {
  stage=$1
  app_port=$(resolve_app_port)
  base_url="http://127.0.0.1:${app_port}"
  health_url="${base_url}/api/health"
  login_url="${base_url}/login"
  attempt_log="${REPORT_DIR_ABSOLUTE}/${stage}-smoke-attempts.log"
  health_body_file="${REPORT_DIR_ABSOLUTE}/${stage}-health-last.txt"
  login_body_file="${REPORT_DIR_ABSOLUTE}/${stage}-login-last.txt"

  : > "$attempt_log"

  log_deploy "Running ${stage} smoke against ${health_url} and ${login_url}..."

  attempt=1
  while [ "$attempt" -le "$DEPLOY_SMOKE_MAX_ATTEMPTS" ]; do
    health_ok=1
    login_ok=1
    health_response=

    if fetch_url_to_file "$health_url" "$health_body_file" >/dev/null 2>&1; then
      health_ok=0
      health_response=$(cat "$health_body_file")
    else
      health_response=$(cat "$health_body_file" 2>/dev/null || true)
    fi

    if fetch_url_to_file "$login_url" "$login_body_file" >/dev/null 2>&1; then
      login_ok=0
    fi

    printf 'attempt=%s health_ok=%s login_ok=%s status_hint=%s\n' \
      "$attempt" \
      "$health_ok" \
      "$login_ok" \
      "$(printf '%s' "$health_response" | tr '\n' ' ' | cut -c 1-160)" >> "$attempt_log"

    if [ "$health_ok" -eq 0 ] && [ "$login_ok" -eq 0 ] && \
       printf '%s' "$health_response" | grep -q '"status":"ok"' && \
       printf '%s' "$health_response" | grep -q '"database":"ok"'; then
      update_smoke_status "$stage" "passed" "$attempt" "$base_url"
      log_deploy "${stage} smoke passed on attempt ${attempt}/${DEPLOY_SMOKE_MAX_ATTEMPTS}."
      return 0
    fi

    if [ "$attempt" -lt "$DEPLOY_SMOKE_MAX_ATTEMPTS" ]; then
      log_deploy "${stage} smoke attempt ${attempt}/${DEPLOY_SMOKE_MAX_ATTEMPTS} not ready; waiting ${DEPLOY_SMOKE_WAIT_SECONDS}s..."
      sleep "$DEPLOY_SMOKE_WAIT_SECONDS"
    fi

    attempt=$((attempt + 1))
  done

  update_smoke_status "$stage" "failed" "$DEPLOY_SMOKE_MAX_ATTEMPTS" "$base_url"
  log_deploy "${stage} smoke failed after ${DEPLOY_SMOKE_MAX_ATTEMPTS} attempts."
  return 1
}

rollback_previous_release() {
  ROLLBACK_TRIGGERED=1
  ROLLBACK_STATUS="running"
  ROLLBACK_MESSAGE="Rollback in progress."

  log_deploy "Rolling back to previous commit ${PREVIOUS_COMMIT}..."
  git checkout --detach "$PREVIOUS_COMMIT"

  log_deploy "Restoring ${DEPLOY_ENV_FILE}..."
  restore_env_file

  FINAL_APP_IMAGE=$(resolve_env_app_image)

  log_deploy "Pulling previous application image..."
  compose_with_current_image pull app

  log_deploy "Restarting stack with previous release..."
  compose_with_current_image up -d --no-build

  if run_post_deploy_smoke rollback; then
    ROLLBACK_STATUS="succeeded"
    ROLLBACK_MESSAGE="Rollback smoke passed. Previous release restored."
    FINAL_COMMIT=$(git rev-parse HEAD)
    capture_runtime_diagnostics "rollback-final"
    log_deploy "Rollback smoke passed. Previous release restored."
    return 0
  fi

  ROLLBACK_STATUS="failed"
  ROLLBACK_MESSAGE="Rollback smoke failed. Manual intervention is required."
  capture_runtime_diagnostics "rollback-failed"
  log_deploy "Rollback smoke also failed. Manual intervention is required."
  return 1
}

log_deploy "Fetching latest git state for ${DEPLOY_REF}..."
git fetch --all --tags --prune

if git show-ref --verify --quiet "refs/remotes/origin/${DEPLOY_REF}"; then
  log_deploy "Deploying branch origin/${DEPLOY_REF}..."
  if git show-ref --verify --quiet "refs/heads/${DEPLOY_REF}"; then
    git checkout "$DEPLOY_REF"
  else
    git checkout --track "origin/${DEPLOY_REF}"
  fi
  git pull --ff-only origin "$DEPLOY_REF"
else
  log_deploy "Deploying non-branch ref ${DEPLOY_REF} in detached HEAD mode..."
  git fetch origin "$DEPLOY_REF" --depth 1
  git checkout --detach FETCH_HEAD
fi

DEPLOYED_COMMIT=$(git rev-parse HEAD)
FINAL_COMMIT=$DEPLOYED_COMMIT
log_deploy "Using commit ${DEPLOYED_COMMIT}..."

log_deploy "Logging into ghcr.io..."
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

log_deploy "Updating ${DEPLOY_ENV_FILE} with APP_IMAGE=${APP_IMAGE}..."
TMP_ENV_UPDATE_FILE=$(mktemp)

if [ -f "$DEPLOY_ENV_FILE" ]; then
  grep -v '^APP_IMAGE=' "$DEPLOY_ENV_FILE" > "$TMP_ENV_UPDATE_FILE" || true
else
  : > "$TMP_ENV_UPDATE_FILE"
fi

printf 'APP_IMAGE=%s\n' "$APP_IMAGE" >> "$TMP_ENV_UPDATE_FILE"
mv "$TMP_ENV_UPDATE_FILE" "$DEPLOY_ENV_FILE"
TMP_ENV_UPDATE_FILE=
FINAL_APP_IMAGE="$APP_IMAGE"

log_deploy "Pulling latest application image..."
compose_with_current_image pull app

log_deploy "Restarting stack with pulled image..."
compose_with_current_image up -d --no-build

if ! run_post_deploy_smoke deploy; then
  capture_runtime_diagnostics "deploy-smoke-failed"
  if rollback_previous_release; then
    DEPLOY_STATUS="rolled_back"
    DEPLOY_MESSAGE="Post-deploy smoke failed and the script restored the previous release."
  else
    DEPLOY_STATUS="rollback_failed"
    DEPLOY_MESSAGE="Post-deploy smoke failed and rollback smoke also failed."
  fi
  exit 1
fi

DEPLOY_STATUS="succeeded"
DEPLOY_MESSAGE="Deployment finished and post-deploy smoke passed."
capture_runtime_diagnostics "deploy-final"

log_deploy "Current stack status:"
compose_with_current_image ps
