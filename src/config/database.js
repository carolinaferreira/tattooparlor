module.exports = {
  dialect: 'postgres',
  host: 'localhost',
  username: 'postgres',
  password: 'docker',
  database: 'gotattoo',
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
};
