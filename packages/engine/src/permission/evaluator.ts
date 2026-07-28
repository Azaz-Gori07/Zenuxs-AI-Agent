import type { PermissionRequest, PermissionDecision, PermissionRule, PermissionRuleset, PermissionAction } from "@zenuxs/schema"

export interface PermissionEvalOptions {
  defaultAction?: PermissionAction
}

export class PermissionEvaluator {
  private globalRules: PermissionRule[] = []
  private defaultAction: PermissionAction

  constructor(options: PermissionEvalOptions = {}) {
    this.defaultAction = options.defaultAction ?? "ask"
  }

  setRules(rules: PermissionRuleset): void {
    this.globalRules = rules
  }

  addRule(rule: PermissionRule): void {
    this.globalRules.push(rule)
  }

  matchesPattern(value: string, pattern: string): boolean {
    if (pattern === "*") return true
    if (pattern === value) return true
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$")
    return regex.test(value)
  }

  async evaluate(request: PermissionRequest): Promise<PermissionDecision> {
    for (const rule of this.globalRules) {
      if (this.matchesPattern(request.pattern, rule.pattern) && rule.permission === request.permission) {
        return { action: rule.action, rule, reason: `Matched rule: ${rule.permission}/${rule.pattern}` }
      }
      if (this.matchesPattern(request.pattern, "*") && rule.permission === request.permission) {
        return { action: rule.action, rule, reason: `Matched wildcard rule: ${rule.permission}/*` }
      }
    }

    const alwaysPatterns = request.always ?? []
    for (const pattern of alwaysPatterns) {
      for (const rule of this.globalRules) {
        if (this.matchesPattern(pattern, rule.pattern)) {
          return { action: rule.action, rule, reason: `Matched always pattern: ${pattern}` }
        }
      }
    }

    return { action: this.defaultAction, reason: `No matching rule, using default: ${this.defaultAction}` }
  }

  merge(rulesets: PermissionRuleset[]): PermissionRule[] {
    const merged = new Map<string, PermissionRule>()
    for (const ruleset of rulesets) {
      for (const rule of ruleset) {
        const key = `${rule.permission}:${rule.pattern}`
        merged.set(key, rule)
      }
    }
    return Array.from(merged.values())
  }
}

export * as Permission from "."