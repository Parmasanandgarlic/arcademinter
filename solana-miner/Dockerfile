FROM rust:1.72-slim as builder
RUN apt-get update && apt-get install -y libssl-dev libudev-dev pkg-config git
RUN cargo install solanity
FROM debian:stable-slim
COPY --from=builder /usr/local/cargo/bin/solanity /usr/local/bin/
COPY ./run_miner.sh /
RUN apt-get update && apt-get install -y curl
ENTRYPOINT ["/run_miner.sh"]

