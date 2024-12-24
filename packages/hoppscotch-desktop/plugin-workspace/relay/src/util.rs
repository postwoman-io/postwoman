pub trait ToCurlVersion {
    fn to_curl_version(self) -> curl::easy::HttpVersion;
}

impl ToCurlVersion for http::Version {
    fn to_curl_version(self) -> curl::easy::HttpVersion {
        match self {
            http::Version::HTTP_10 => curl::easy::HttpVersion::V10,
            http::Version::HTTP_11 => curl::easy::HttpVersion::V11,
            http::Version::HTTP_2 => curl::easy::HttpVersion::V2,
            http::Version::HTTP_3 => curl::easy::HttpVersion::V3,
            _ => panic!("Unsupported"),
        }
    }
}
