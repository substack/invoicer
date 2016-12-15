FROM node:7.2.1
RUN apt-get update && \
    apt-get install -y texlive && \
    npm install -g invoicer && \
    useradd -b /home -U -m invoicer
WORKDIR /home/invoicer
VOLUME /home/invoicer
USER invoicer
COPY invoicer .
ENTRYPOINT ["invoicer"]
