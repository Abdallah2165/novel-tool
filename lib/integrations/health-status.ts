const HEALTH_STATUS_LABELS: Record<string, string> = {
  healthy: "可用",
  degraded: "受限",
  invalid_auth: "鉴权失败",
  unreachable: "无法连接",
  misconfigured: "配置有误",
};

export function getHealthStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "未检查";
  }

  return HEALTH_STATUS_LABELS[status] ?? status;
}
