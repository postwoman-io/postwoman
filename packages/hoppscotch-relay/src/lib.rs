pub(crate) mod error;
pub(crate) mod interop;
pub(crate) mod relay;
pub(crate) mod util;

pub use error::{RelayError, RelayResult};
pub use interop::{RequestWithMetadata, ResponseWithMetadata};
pub use relay::run_request_task;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
