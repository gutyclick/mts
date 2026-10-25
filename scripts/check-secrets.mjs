import { execFileSync } from "node:child_process";

// Read the index, not working files: these are the exact bytes a commit records.
const files = execFileSync("git", ["ls-files", "--cached", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const rules = [
  [
    "private key",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  ],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["Stripe secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["Supabase key", /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}\b/],
  [
    "JWT credential",
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  ],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["database credentials", /postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"/]+@/i],
  ["Resend key", /\bre_[A-Za-z0-9]{24,}\b/],
  [
    "assigned credential",
    /(?:api[_-]?key|secret[_-]?key|service[_-]?role[_-]?key|access[_-]?token|access[_-]?code|esim_access_sync_secret|password)\s*[=:]\s*["'][A-Za-z0-9_+\/.=-]{20,}["']/i,
  ],
];
const findings = [];
for (const file of files) {
  if (
    /(^|\/)(?:\.env(?!\.example$)(?:\.|$)|\.vercel\/|\.supabase\/)|\.(?:pem|key|p12|pfx)$/i.test(
      file,
    )
  ) {
    findings.push(`${file}: sensitive file must not be committed`);
    continue;
  }
  const content = execFileSync("git", ["show", `:${file}`], {
    maxBuffer: 20 * 1024 * 1024,
  });
  if (content.includes(0)) continue; // Images and other binary assets.
  for (const [index, line] of content
    .toString("utf8")
    .split(/\r?\n/)
    .entries()) {
    for (const [name, pattern] of rules) {
      if (pattern.test(line))
        findings.push(`${file}:${index + 1}: possible ${name}`);
    }
  }
}
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${files.length} staged files: no credential patterns or forbidden files found.`,
  );
}
