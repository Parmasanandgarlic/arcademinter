FROM nvidia/cuda:11.8.0-devel-ubuntu20.04 as builder
RUN apt-get update && apt-get install -y git build-essential
WORKDIR /
RUN git clone https://github.com/1inch/profanity2.git
WORKDIR /profanity2/
RUN make
FROM nvidia/cuda:11.8.0-base-ubuntu20.04
COPY --from=builder /profanity2/profanity2 /usr/local/bin/
COPY ./run_miner.sh /
RUN apt-get update && apt-get install -y curl
ENTRYPOINT ["/run_miner.sh"]

