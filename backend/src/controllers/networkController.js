const getNetworks = (req, res) => {
  const networks = [
    {
      id: 1,
      name: "MTN",
      code: "mtn",
    },
    {
      id: 2,
      name: "Airtel",
      code: "airtel",
    },
    {
      id: 3,
      name: "Glo",
      code: "glo",
    },
    {
      id: 4,
      name: "9mobile",
      code: "9mobile",
    },
  ];

  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.json({
    success: true,
    count: networks.length,
    networks,
  });
};

module.exports = {
  getNetworks,
};