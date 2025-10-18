const listenForNewMessages = async (onMessage, redisClient) => {
  while (true) {
    const response = await redisClient.xRead(
      { key: "tradeStream", id: "$" },
      { BLOCK: 0, COUNT: 1 }
    );

    if (response) {
      for (const stream of response) {
        for (const message of stream.messages) {
          onMessage({
            id: message.id,
            fields: message.message,
          });
        }
      }
    }
  }
};

module.exports = listenForNewMessages;
