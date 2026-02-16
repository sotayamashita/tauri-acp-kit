use crate::agent_registry::{AgentDistribution, AgentRegistryEntry, PlatformInfo};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Emitter;

/// Status of a managed agent.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AgentStatus {
    NotInstalled,
    Downloading { progress: f64 },
    Installed {
        version: String,
        executable_path: String,
    },
    Failed { error: String },
}

/// Phase of a download operation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadPhase {
    Resolving,
    Downloading,
    Verifying,
    Extracting,
    Complete,
    Failed,
}

/// Progress event payload for download operations.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub agent_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub phase: DownloadPhase,
}

/// Resolved agent binary information.
#[derive(Debug, Clone, Serialize)]
pub struct ResolvedAgent {
    pub executable: String,
    pub args: Vec<String>,
    pub version: String,
}

/// Errors specific to the download manager.
#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("Unsupported platform")]
    UnsupportedPlatform,

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("SHA-256 hash mismatch")]
    HashMismatch,

    #[error("Node.js not found on PATH")]
    NodeNotFound,

    #[error("npm not found on PATH")]
    NpmNotFound,

    #[error("npm install failed: {0}")]
    NpmInstallFailed(String),

    #[error("Entry point not found: {0}")]
    EntryPointNotFound(String),

    #[error("GitHub API error: {0}")]
    GithubApiError(String),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
}

impl From<DownloadError> for crate::error::Error {
    fn from(e: DownloadError) -> Self {
        crate::error::Error::Protocol(e.to_string())
    }
}

/// Manages agent binary downloads and installations.
#[derive(Debug)]
pub struct AgentDownloadManager {
    base_dir: PathBuf,
}

impl AgentDownloadManager {
    /// Create a new download manager rooted at `{app_data_dir}/agents/`.
    pub fn new(app_data_dir: PathBuf) -> std::io::Result<Self> {
        let base_dir = app_data_dir.join("agents");
        std::fs::create_dir_all(&base_dir)?;
        Ok(Self { base_dir })
    }

    /// Get the base directory for agent storage.
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Check if an agent is installed locally.
    pub fn check_status(&self, entry: &AgentRegistryEntry) -> AgentStatus {
        match &entry.distribution {
            AgentDistribution::GithubRelease { .. } => {
                self.check_github_release_status(entry)
            }
            AgentDistribution::NpmPackage {
                package_name,
                entry_point,
            } => self.check_npm_package_status(entry, package_name, entry_point),
        }
    }

    fn check_github_release_status(&self, entry: &AgentRegistryEntry) -> AgentStatus {
        let agent_dir = self.base_dir.join(&entry.id);
        if !agent_dir.exists() {
            return AgentStatus::NotInstalled;
        }
        let Ok(entries) = std::fs::read_dir(&agent_dir) else {
            return AgentStatus::NotInstalled;
        };
        for dir_entry in entries.flatten() {
            if dir_entry.path().is_dir() {
                let bin_name = binary_name_for_id(&entry.id);
                let binary_path = dir_entry.path().join(&bin_name);
                if binary_path.exists() {
                    let version = dir_entry.file_name().to_string_lossy().to_string();
                    return AgentStatus::Installed {
                        version,
                        executable_path: binary_path.to_string_lossy().to_string(),
                    };
                }
            }
        }
        AgentStatus::NotInstalled
    }

    fn check_npm_package_status(
        &self,
        entry: &AgentRegistryEntry,
        package_name: &str,
        entry_point: &str,
    ) -> AgentStatus {
        let entry_path = self
            .base_dir
            .join(&entry.id)
            .join("node_modules")
            .join(package_name)
            .join(entry_point);

        if entry_path.exists() {
            AgentStatus::Installed {
                version: "local".to_string(),
                executable_path: entry_path.to_string_lossy().to_string(),
            }
        } else {
            AgentStatus::NotInstalled
        }
    }

    /// Resolve an agent executable, downloading if necessary.
    pub async fn resolve_executable<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        entry: &AgentRegistryEntry,
    ) -> Result<ResolvedAgent, DownloadError> {
        // Check if already installed
        if let AgentStatus::Installed {
            version,
            executable_path,
        } = self.check_status(entry)
        {
            return Ok(match &entry.distribution {
                AgentDistribution::GithubRelease { .. } => ResolvedAgent {
                    executable: executable_path,
                    args: vec![],
                    version,
                },
                AgentDistribution::NpmPackage { .. } => {
                    let node = detect_node().await.ok_or(DownloadError::NodeNotFound)?;
                    ResolvedAgent {
                        executable: node,
                        args: vec![executable_path],
                        version,
                    }
                }
            });
        }

        // Download/install
        match &entry.distribution {
            AgentDistribution::GithubRelease {
                owner,
                repo,
                asset_template,
            } => {
                self.download_github_release(app, entry, owner, repo, asset_template)
                    .await
            }
            AgentDistribution::NpmPackage {
                package_name,
                entry_point,
            } => {
                self.install_npm_package(app, entry, package_name, entry_point)
                    .await
            }
        }
    }

    /// Download a GitHub release binary.
    async fn download_github_release<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        entry: &AgentRegistryEntry,
        owner: &str,
        repo: &str,
        asset_template: &str,
    ) -> Result<ResolvedAgent, DownloadError> {
        let platform = PlatformInfo::detect().ok_or(DownloadError::UnsupportedPlatform)?;

        emit_download_progress(app, &entry.id, DownloadPhase::Resolving, 0, None);

        // Fetch latest release from GitHub API
        let api_url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            owner, repo
        );
        let client = reqwest::Client::new();
        let release: serde_json::Value = client
            .get(&api_url)
            .header("User-Agent", "tauri-acp-kit")
            .send()
            .await?
            .json()
            .await?;

        let tag = release["tag_name"]
            .as_str()
            .ok_or_else(|| DownloadError::GithubApiError("No tag_name in release".to_string()))?;
        let version = tag.strip_prefix('v').unwrap_or(tag);

        // Construct asset name from template
        let asset_name = asset_template
            .replace("{version}", version)
            .replace("{target}", &platform.target())
            .replace("{ext}", platform.ext);

        // Find download URL
        let assets = release["assets"]
            .as_array()
            .ok_or_else(|| DownloadError::GithubApiError("No assets array".to_string()))?;
        let asset = assets
            .iter()
            .find(|a| a["name"].as_str() == Some(&asset_name))
            .ok_or_else(|| {
                DownloadError::GithubApiError(format!(
                    "Asset '{}' not found in release",
                    asset_name
                ))
            })?;
        let download_url = asset["browser_download_url"]
            .as_str()
            .ok_or_else(|| DownloadError::GithubApiError("No browser_download_url".to_string()))?;

        // Prepare directories
        let version_dir = self.base_dir.join(&entry.id).join(version);
        std::fs::create_dir_all(&version_dir)?;
        let temp_dir = tempfile::tempdir()?;
        let archive_path = temp_dir.path().join(&asset_name);

        // Download archive
        self.download_file_with_progress(app, &entry.id, download_url, &archive_path)
            .await?;

        // Extract
        emit_download_progress(app, &entry.id, DownloadPhase::Extracting, 0, None);
        if platform.ext == "tar.gz" {
            extract_tar_gz(&archive_path, &version_dir)?;
        } else {
            extract_zip(&archive_path, &version_dir)?;
        }

        // Set executable permissions on Unix
        let bin_name = binary_name_for_id(&entry.id);
        let binary_path = version_dir.join(&bin_name);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if binary_path.exists() {
                std::fs::set_permissions(
                    &binary_path,
                    std::fs::Permissions::from_mode(0o755),
                )?;
            }
        }

        // Cleanup old versions
        self.cleanup_old_versions(&entry.id, version)?;

        emit_download_progress(app, &entry.id, DownloadPhase::Complete, 0, None);

        Ok(ResolvedAgent {
            executable: binary_path.to_string_lossy().to_string(),
            args: vec![],
            version: version.to_string(),
        })
    }

    /// Install an npm package.
    async fn install_npm_package<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        entry: &AgentRegistryEntry,
        package_name: &str,
        entry_point: &str,
    ) -> Result<ResolvedAgent, DownloadError> {
        let node = detect_node().await.ok_or(DownloadError::NodeNotFound)?;
        let npm = detect_npm().await.ok_or(DownloadError::NpmNotFound)?;

        emit_download_progress(app, &entry.id, DownloadPhase::Resolving, 0, None);

        // Create install directory
        let install_dir = self.base_dir.join(&entry.id);
        std::fs::create_dir_all(&install_dir)?;

        // Run npm install
        emit_download_progress(app, &entry.id, DownloadPhase::Downloading, 0, None);
        let output = tokio::process::Command::new(&npm)
            .arg("install")
            .arg(package_name)
            .current_dir(&install_dir)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(DownloadError::NpmInstallFailed(stderr.to_string()));
        }

        // Verify entry point exists
        let entry_path = install_dir
            .join("node_modules")
            .join(package_name)
            .join(entry_point);
        if !entry_path.exists() {
            return Err(DownloadError::EntryPointNotFound(
                entry_path.to_string_lossy().to_string(),
            ));
        }

        emit_download_progress(app, &entry.id, DownloadPhase::Complete, 0, None);

        Ok(ResolvedAgent {
            executable: node,
            args: vec![entry_path.to_string_lossy().to_string()],
            version: "latest".to_string(),
        })
    }

    /// Download a file with progress events.
    async fn download_file_with_progress<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        agent_id: &str,
        url: &str,
        dest: &Path,
    ) -> Result<(), DownloadError> {
        use futures_util::StreamExt;

        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("User-Agent", "tauri-acp-kit")
            .send()
            .await?;

        let total_bytes = response.content_length();
        let mut stream = response.bytes_stream();
        let mut file = std::fs::File::create(dest)?;
        let mut downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            std::io::Write::write_all(&mut file, &chunk)?;
            downloaded += chunk.len() as u64;
            emit_download_progress(
                app,
                agent_id,
                DownloadPhase::Downloading,
                downloaded,
                total_bytes,
            );
        }

        Ok(())
    }

    /// Remove old version directories, keeping only the current version.
    pub fn cleanup_old_versions(
        &self,
        agent_id: &str,
        current_version: &str,
    ) -> std::io::Result<()> {
        let agent_dir = self.base_dir.join(agent_id);
        if !agent_dir.exists() {
            return Ok(());
        }
        for dir_entry in std::fs::read_dir(&agent_dir)?.flatten() {
            if dir_entry.path().is_dir() {
                let dir_name = dir_entry.file_name().to_string_lossy().to_string();
                if dir_name != current_version {
                    let _ = std::fs::remove_dir_all(dir_entry.path());
                }
            }
        }
        Ok(())
    }
}

/// Construct the binary name for an agent ID (adds .exe on Windows).
pub fn binary_name_for_id(id: &str) -> String {
    if cfg!(windows) {
        format!("{}.exe", id)
    } else {
        id.to_string()
    }
}

/// Extract a tar.gz archive to a destination directory.
pub fn extract_tar_gz(archive_path: &Path, dest_dir: &Path) -> std::io::Result<()> {
    let file = std::fs::File::open(archive_path)?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);
    archive.unpack(dest_dir)?;
    Ok(())
}

/// Extract a zip archive to a destination directory.
pub fn extract_zip(archive_path: &Path, dest_dir: &Path) -> Result<(), DownloadError> {
    let file = std::fs::File::open(archive_path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    archive.extract(dest_dir)?;
    Ok(())
}

/// Verify the SHA-256 hash of a file.
pub fn verify_sha256(file_path: &Path, expected_hex: &str) -> std::io::Result<bool> {
    use sha2::{Digest, Sha256};
    let mut file = std::fs::File::open(file_path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    let result = hasher.finalize();
    let hex = format!("{:x}", result);
    Ok(hex == expected_hex.to_lowercase())
}

/// Detect Node.js on the system PATH.
pub async fn detect_node() -> Option<String> {
    detect_command("node").await
}

/// Detect npm on the system PATH.
pub async fn detect_npm() -> Option<String> {
    detect_command("npm").await
}

/// Find a command on PATH using `which` (Unix) or `where` (Windows).
async fn detect_command(name: &str) -> Option<String> {
    let which_cmd = if cfg!(windows) { "where" } else { "which" };
    let output = tokio::process::Command::new(which_cmd)
        .arg(name)
        .output()
        .await
        .ok()?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // `which` may return multiple lines; take the first
        stdout.trim().lines().next().map(|s| s.to_string())
    } else {
        None
    }
}

/// Emit a download progress event via Tauri.
fn emit_download_progress<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    agent_id: &str,
    phase: DownloadPhase,
    bytes_downloaded: u64,
    total_bytes: Option<u64>,
) {
    let progress = DownloadProgress {
        agent_id: agent_id.to_string(),
        bytes_downloaded,
        total_bytes,
        phase,
    };
    let _ = app.emit("acp://download-progress", &progress);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_registry::VersionPolicy;
    use std::io::Write;

    fn github_release_entry(id: &str) -> AgentRegistryEntry {
        AgentRegistryEntry {
            id: id.to_string(),
            label: "Test".to_string(),
            distribution: AgentDistribution::GithubRelease {
                owner: "test".to_string(),
                repo: "agent".to_string(),
                asset_template: "test-{version}-{target}.{ext}".to_string(),
            },
            version_policy: VersionPolicy::Latest,
        }
    }

    fn npm_package_entry() -> AgentRegistryEntry {
        AgentRegistryEntry {
            id: "claude-code-acp".to_string(),
            label: "Claude Code".to_string(),
            distribution: AgentDistribution::NpmPackage {
                package_name: "@zed-industries/claude-code-acp".to_string(),
                entry_point: "dist/index.js".to_string(),
            },
            version_policy: VersionPolicy::Latest,
        }
    }

    // --- AgentDownloadManager tests ---

    #[test]
    fn new_creates_agents_directory() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();
        assert!(manager.base_dir().exists());
        assert!(manager.base_dir().ends_with("agents"));
    }

    #[test]
    fn check_status_not_installed_when_no_directory() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();
        let entry = github_release_entry("test-agent");
        match manager.check_status(&entry) {
            AgentStatus::NotInstalled => {}
            other => panic!("Expected NotInstalled, got {:?}", other),
        }
    }

    #[test]
    fn check_status_installed_for_github_release() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();

        // Create fake installed binary
        let version_dir = manager.base_dir().join("test-agent").join("1.0.0");
        std::fs::create_dir_all(&version_dir).unwrap();
        std::fs::File::create(version_dir.join("test-agent")).unwrap();

        let entry = github_release_entry("test-agent");
        match manager.check_status(&entry) {
            AgentStatus::Installed {
                version,
                executable_path,
            } => {
                assert_eq!(version, "1.0.0");
                assert!(executable_path.contains("test-agent"));
            }
            other => panic!("Expected Installed, got {:?}", other),
        }
    }

    #[test]
    fn check_status_not_installed_when_version_dir_empty() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();

        // Create version dir without binary
        let version_dir = manager.base_dir().join("test-agent").join("1.0.0");
        std::fs::create_dir_all(&version_dir).unwrap();

        let entry = github_release_entry("test-agent");
        match manager.check_status(&entry) {
            AgentStatus::NotInstalled => {}
            other => panic!("Expected NotInstalled, got {:?}", other),
        }
    }

    #[test]
    fn check_status_installed_for_npm_package() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();

        // Create fake npm install
        let entry_dir = manager
            .base_dir()
            .join("claude-code-acp")
            .join("node_modules")
            .join("@zed-industries")
            .join("claude-code-acp")
            .join("dist");
        std::fs::create_dir_all(&entry_dir).unwrap();
        std::fs::File::create(entry_dir.join("index.js")).unwrap();

        let entry = npm_package_entry();
        match manager.check_status(&entry) {
            AgentStatus::Installed {
                executable_path, ..
            } => {
                assert!(executable_path.contains("index.js"));
            }
            other => panic!("Expected Installed, got {:?}", other),
        }
    }

    #[test]
    fn check_status_not_installed_for_npm_without_entry_point() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();

        // Create partial install (no entry point)
        let pkg_dir = manager
            .base_dir()
            .join("claude-code-acp")
            .join("node_modules")
            .join("@zed-industries")
            .join("claude-code-acp");
        std::fs::create_dir_all(&pkg_dir).unwrap();

        let entry = npm_package_entry();
        match manager.check_status(&entry) {
            AgentStatus::NotInstalled => {}
            other => panic!("Expected NotInstalled, got {:?}", other),
        }
    }

    // --- extract_tar_gz tests ---

    #[test]
    fn extract_tar_gz_extracts_single_file() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("test.tar.gz");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
            let mut builder = tar::Builder::new(enc);

            let data = b"hello world";
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder
                .append_data(&mut header, "test.txt", &data[..])
                .unwrap();
            builder.finish().unwrap();
        }

        let dest = temp.path().join("extracted");
        std::fs::create_dir_all(&dest).unwrap();
        extract_tar_gz(&archive_path, &dest).unwrap();

        let content = std::fs::read_to_string(dest.join("test.txt")).unwrap();
        assert_eq!(content, "hello world");
    }

    #[test]
    fn extract_tar_gz_fails_on_nonexistent_file() {
        let temp = tempfile::tempdir().unwrap();
        let result = extract_tar_gz(
            &temp.path().join("nonexistent.tar.gz"),
            &temp.path().join("dest"),
        );
        assert!(result.is_err());
    }

    // --- extract_zip tests ---

    #[test]
    fn extract_zip_extracts_single_file() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("test.zip");

        {
            let file = std::fs::File::create(&archive_path).unwrap();
            let mut zip_writer = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default();
            zip_writer.start_file("test.txt", options).unwrap();
            zip_writer.write_all(b"hello zip").unwrap();
            zip_writer.finish().unwrap();
        }

        let dest = temp.path().join("extracted");
        std::fs::create_dir_all(&dest).unwrap();
        extract_zip(&archive_path, &dest).unwrap();

        let content = std::fs::read_to_string(dest.join("test.txt")).unwrap();
        assert_eq!(content, "hello zip");
    }

    // --- verify_sha256 tests ---

    #[test]
    fn verify_sha256_matching_hash() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("test.bin");
        std::fs::write(&file_path, b"hello").unwrap();

        // SHA-256 of "hello"
        let expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
        assert!(verify_sha256(&file_path, expected).unwrap());
    }

    #[test]
    fn verify_sha256_mismatching_hash() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("test.bin");
        std::fs::write(&file_path, b"hello").unwrap();

        let wrong = "0000000000000000000000000000000000000000000000000000000000000000";
        assert!(!verify_sha256(&file_path, wrong).unwrap());
    }

    #[test]
    fn verify_sha256_case_insensitive() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("test.bin");
        std::fs::write(&file_path, b"hello").unwrap();

        let upper = "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824";
        assert!(verify_sha256(&file_path, upper).unwrap());
    }

    #[test]
    fn verify_sha256_nonexistent_file() {
        let temp = tempfile::tempdir().unwrap();
        let result = verify_sha256(&temp.path().join("nonexistent"), "abc");
        assert!(result.is_err());
    }

    // --- detect_node / detect_npm tests ---

    #[tokio::test]
    async fn detect_node_returns_path_or_none() {
        let result = detect_node().await;
        if let Some(path) = &result {
            assert!(!path.is_empty());
        }
        // Either outcome is valid
    }

    #[tokio::test]
    async fn detect_npm_returns_path_or_none() {
        let result = detect_npm().await;
        if let Some(path) = &result {
            assert!(!path.is_empty());
        }
    }

    // --- binary_name_for_id tests ---

    #[test]
    fn binary_name_no_exe_on_unix() {
        if !cfg!(windows) {
            assert_eq!(binary_name_for_id("codex-acp"), "codex-acp");
        }
    }

    // --- cleanup_old_versions tests ---

    #[test]
    fn cleanup_old_versions_removes_old_dirs() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();

        let agent_dir = manager.base_dir().join("test-agent");
        std::fs::create_dir_all(agent_dir.join("0.9.0")).unwrap();
        std::fs::create_dir_all(agent_dir.join("0.9.1")).unwrap();
        std::fs::create_dir_all(agent_dir.join("0.9.2")).unwrap();

        manager
            .cleanup_old_versions("test-agent", "0.9.2")
            .unwrap();

        assert!(!agent_dir.join("0.9.0").exists());
        assert!(!agent_dir.join("0.9.1").exists());
        assert!(agent_dir.join("0.9.2").exists());
    }

    #[test]
    fn cleanup_old_versions_no_error_when_dir_missing() {
        let temp = tempfile::tempdir().unwrap();
        let manager = AgentDownloadManager::new(temp.path().to_path_buf()).unwrap();
        manager
            .cleanup_old_versions("nonexistent", "1.0.0")
            .unwrap();
    }

    // --- DownloadError conversion test ---

    #[test]
    fn download_error_converts_to_crate_error() {
        let err: crate::error::Error = DownloadError::NodeNotFound.into();
        assert!(err.to_string().contains("Node.js not found"));
    }
}
