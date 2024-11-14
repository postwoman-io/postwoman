use std::collections::HashMap;

use regex::Regex;

#[derive(Debug)]
pub(super) struct Replacer {
    script_placeholder: &'static str,
}

impl Replacer {
    pub(super) fn new() -> Self {
        Self {
            script_placeholder: r#"JSON.parse('"import_meta_env_placeholder"')"#,
        }
    }

    fn prepend_slash(c: char, count: usize) -> String {
        format!("{}{}", "\\".repeat(count * 2), c)
    }

    fn create_pattern(
        &self,
        double_quote_slash_count: usize,
        single_quote_slash_count: usize,
    ) -> Regex {
        let mut pattern = self.script_placeholder.to_string();
        pattern = pattern.replace(r"([\(\)])", r"\$1");

        pattern = pattern.replace('"', &Self::prepend_slash('"', double_quote_slash_count));
        pattern = pattern.replace('\'', &Self::prepend_slash('\'', single_quote_slash_count));

        Regex::new(&pattern).unwrap()
    }

    pub(super) fn should_inject_env(&self, code: &str) -> bool {
        self.create_pattern(2, 1).is_match(code)
            || self.create_pattern(1, 0).is_match(code)
            || self.create_pattern(0, 0).is_match(code)
    }

    fn replace_placeholder(
        &self,
        regex: &Regex,
        code: &str,
        env_vars: &HashMap<String, String>,
        double_quote_slash_count: usize,
    ) -> String {
        regex
            .replace_all(code, |_: &regex::Captures| {
                let serialized = serde_json::to_string(env_vars).unwrap();
                let escaped = match double_quote_slash_count {
                    2 => serialized.replace('"', r#"\\"#),
                    1 => serialized.replace('"', r#"\"#),
                    _ => serialized,
                };
                format!(r#"JSON.parse('{}')"#, escaped)
            })
            .into_owned()
    }

    pub(super) fn replace_all_placeholders(&self, code: &str, env_vars: &HashMap<String, String>) -> String {
        let mut result = code.to_string();

        for (double_quote_count, single_quote_count) in [(2, 1), (1, 0), (0, 0)] {
            let regex = self.create_pattern(double_quote_count, single_quote_count);
            result = self.replace_placeholder(&regex, &result, env_vars, double_quote_count);
        }

        result
    }
}
