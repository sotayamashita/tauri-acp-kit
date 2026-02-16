use serde::Serialize;

/// How an agent is distributed and installed.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentDistribution {
    GithubRelease {
        owner: String,
        repo: String,
        /// Template for archive asset name, e.g. "codex-acp-{version}-{target}.{ext}"
        asset_template: String,
    },
    NpmPackage {
        package_name: String,
        entry_point: String,
    },
}

/// How agent versions are resolved.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum VersionPolicy {
    Latest,
    Pinned(String),
}

/// A registry entry describing a downloadable agent.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRegistryEntry {
    pub id: String,
    pub label: String,
    pub distribution: AgentDistribution,
    pub version_policy: VersionPolicy,
}

/// Platform detection info for constructing download URLs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformInfo {
    pub arch: &'static str,
    pub os: &'static str,
    pub ext: &'static str,
}

impl PlatformInfo {
    /// Detect the current platform for download URL construction.
    pub fn detect() -> Option<Self> {
        let arch = match std::env::consts::ARCH {
            "aarch64" => "aarch64",
            "x86_64" => "x86_64",
            _ => return None,
        };

        let (os, ext) = match std::env::consts::OS {
            "macos" => ("apple-darwin", "tar.gz"),
            "linux" => ("unknown-linux-gnu", "tar.gz"),
            "windows" => ("pc-windows-msvc", "zip"),
            _ => return None,
        };

        Some(PlatformInfo { arch, os, ext })
    }

    /// Construct the Rust target triple (e.g. "aarch64-apple-darwin").
    pub fn target(&self) -> String {
        format!("{}-{}", self.arch, self.os)
    }
}

/// Returns the default hardcoded agent registry with codex-acp and claude-code-acp.
pub fn default_registry() -> Vec<AgentRegistryEntry> {
    vec![
        AgentRegistryEntry {
            id: "codex-acp".to_string(),
            label: "Codex".to_string(),
            distribution: AgentDistribution::GithubRelease {
                owner: "zed-industries".to_string(),
                repo: "codex-acp".to_string(),
                asset_template: "codex-acp-{version}-{target}.{ext}".to_string(),
            },
            version_policy: VersionPolicy::Latest,
        },
        AgentRegistryEntry {
            id: "claude-code-acp".to_string(),
            label: "Claude Code".to_string(),
            distribution: AgentDistribution::NpmPackage {
                package_name: "@zed-industries/claude-code-acp".to_string(),
                entry_point: "dist/index.js".to_string(),
            },
            version_policy: VersionPolicy::Latest,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_info_detect_returns_some() {
        let info = PlatformInfo::detect();
        assert!(
            info.is_some(),
            "PlatformInfo::detect() should succeed on supported platforms"
        );
        let info = info.unwrap();
        assert!(!info.arch.is_empty());
        assert!(!info.os.is_empty());
        assert!(!info.ext.is_empty());
    }

    #[test]
    fn platform_info_target_format() {
        let info = PlatformInfo {
            arch: "aarch64",
            os: "apple-darwin",
            ext: "tar.gz",
        };
        assert_eq!(info.target(), "aarch64-apple-darwin");
    }

    #[test]
    fn default_registry_contains_both_agents() {
        let registry = default_registry();
        assert_eq!(registry.len(), 2);
        assert_eq!(registry[0].id, "codex-acp");
        assert_eq!(registry[1].id, "claude-code-acp");
    }

    #[test]
    fn default_registry_codex_is_github_release() {
        let registry = default_registry();
        let codex = &registry[0];
        match &codex.distribution {
            AgentDistribution::GithubRelease { owner, repo, .. } => {
                assert_eq!(owner, "zed-industries");
                assert_eq!(repo, "codex-acp");
            }
            _ => panic!("codex-acp should be GithubRelease distribution"),
        }
    }

    #[test]
    fn default_registry_claude_code_is_npm_package() {
        let registry = default_registry();
        let claude = &registry[1];
        match &claude.distribution {
            AgentDistribution::NpmPackage {
                package_name,
                entry_point,
            } => {
                assert_eq!(package_name, "@zed-industries/claude-code-acp");
                assert_eq!(entry_point, "dist/index.js");
            }
            _ => panic!("claude-code-acp should be NpmPackage distribution"),
        }
    }

    #[test]
    fn github_release_url_construction() {
        let platform = PlatformInfo {
            arch: "aarch64",
            os: "apple-darwin",
            ext: "tar.gz",
        };
        let version = "0.9.2";
        let template = "codex-acp-{version}-{target}.{ext}";

        let asset_name = template
            .replace("{version}", version)
            .replace("{target}", &platform.target())
            .replace("{ext}", platform.ext);

        assert_eq!(asset_name, "codex-acp-0.9.2-aarch64-apple-darwin.tar.gz");

        let url = format!(
            "https://github.com/zed-industries/codex-acp/releases/download/v{}/{}",
            version, asset_name
        );
        assert_eq!(
            url,
            "https://github.com/zed-industries/codex-acp/releases/download/v0.9.2/codex-acp-0.9.2-aarch64-apple-darwin.tar.gz"
        );
    }
}
