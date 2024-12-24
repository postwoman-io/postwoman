use regex::Regex;
use std::collections::HashMap;

/// Handles replacing environment variables in HTML content
#[derive(Debug)]
pub(super) struct Replacer {
    // The placeholder we look for and replace
    placeholder_text: &'static str,
}

impl Replacer {
    pub(super) fn new() -> Self {
        tracing::debug!("Creating new Replacer instance");
        Self {
            placeholder_text: "\"import_meta_env_placeholder\"", // Include the quotes in the placeholder
        }
    }

    /// Returns true if the content needs environment variable injection
    pub(super) fn should_inject_env(&self, content: &str) -> bool {
        tracing::debug!(
            content_length = content.len(),
            "Checking if env injection is needed"
        );

        let sample_size = content.len().min(1000);
        tracing::debug!(content_preview = &content[..sample_size], "Content preview");

        // Simple string search first - faster than regex
        if !content.contains(self.placeholder_text) {
            tracing::debug!("Placeholder text not found in content");
            return false;
        }

        // Look for the complete structure
        let pattern = r#"JSON\.parse\(['"]\s*"import_meta_env_placeholder"\s*['"]\)"#;
        let regex = Regex::new(pattern).expect("Failed to compile basic detection regex");

        let needs_injection = regex.is_match(content);
        tracing::debug!(needs_injection, pattern, "Completed injection check");
        needs_injection
    }

    /// Replace all placeholders in the content with environment variables
    pub(super) fn replace_all_placeholders(
        &self,
        content: &str,
        env_vars: &HashMap<String, String>,
    ) -> String {
        tracing::debug!(
            content_length = content.len(),
            env_var_count = env_vars.len(),
            "Starting placeholder replacements"
        );

        // First serialize our env vars to JSON
        let env_json = match serde_json::to_string(env_vars) {
            Ok(json) => json,
            Err(e) => {
                tracing::error!(?e, "Failed to serialize environment variables");
                return content.to_string();
            }
        };

        tracing::debug!(env_json_length = env_json.len(), "Generated env JSON");

        // Create pattern that matches the complete placeholder structure
        let pattern = r#"JSON\.parse\(['"]\s*"import_meta_env_placeholder"\s*['"]\)"#;
        let regex = match Regex::new(pattern) {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(?e, "Failed to compile replacement regex");
                return content.to_string();
            }
        };

        // Replace each occurrence with our env vars JSON
        let result = regex.replace_all(content, format!(r#"JSON.parse('{}')"#, env_json));

        tracing::debug!(
            original_length = content.len(),
            result_length = result.len(),
            "Completed placeholder replacements"
        );

        result.into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_placeholder() {
        let replacer = Replacer::new();
        let content = r#"
            <script>
                globalThis.import_meta_env = JSON.parse('"import_meta_env_placeholder"')
            </script>
        "#;
        assert!(replacer.should_inject_env(content));
    }

    #[test]
    fn does_not_detect_invalid_placeholder() {
        let replacer = Replacer::new();
        let content = r#"
            <script>
                // This shouldn't match
                globalThis.import_meta_env = "import_meta_env_placeholder"
            </script>
        "#;
        assert!(!replacer.should_inject_env(content));
    }

    #[test]
    fn replaces_placeholder() {
        let replacer = Replacer::new();
        let mut env_vars = HashMap::new();
        env_vars.insert("TEST".to_string(), "value".to_string());

        let content = r#"
            <script>
                globalThis.import_meta_env = JSON.parse('"import_meta_env_placeholder"')
            </script>
        "#;

        let result = replacer.replace_all_placeholders(content, &env_vars);
        assert!(result.contains(r#"JSON.parse('{"TEST":"value"}')"#));
    }

    #[test]
    fn handles_multiple_replacements() {
        let replacer = Replacer::new();
        let mut env_vars = HashMap::new();
        env_vars.insert("TEST".to_string(), "value".to_string());

        let content = r#"
            <script>
                let a = JSON.parse('"import_meta_env_placeholder"');
                let b = JSON.parse('"import_meta_env_placeholder"');
            </script>
        "#;

        let result = replacer.replace_all_placeholders(content, &env_vars);
        assert_eq!(
            result.matches(r#"JSON.parse('{"TEST":"value"}')"#).count(),
            2
        );
    }
}
