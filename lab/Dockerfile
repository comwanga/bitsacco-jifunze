# The lab container: the bridge (root inside the container, so it can run learner code as
# uid 1000) plus everything learner code runs with. No Docker socket, no host mounts.
ARG LND_TAG=0.20.0-beta
FROM polarlightning/lnd:${LND_TAG} AS lnd

FROM python:3.12-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends jq curl ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "pyln-client>=25.2" "requests>=2.32,<3"
COPY --from=lnd /opt/lnd/lncli /opt/lnd/lncli
RUN useradd --create-home --uid 1000 learner \
  && useradd --system --no-create-home bridge
COPY jifunze_lab /lab/jifunze_lab
COPY bin/ /usr/local/bin/
COPY scenarios /lab/scenarios
RUN chmod 755 /usr/local/bin/lncli /usr/local/bin/lightning-cli /usr/local/bin/eclair-cli /usr/local/bin/bitcoin-cli \
  && mkdir -p /lab/state && chmod 755 /lab
ENV PYTHONPATH=/lab PYTHONUNBUFFERED=1
WORKDIR /home/learner
EXPOSE 7777
CMD ["python", "-m", "jifunze_lab.bridge"]
