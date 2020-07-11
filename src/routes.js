import { Router } from 'express';
import User from './app/models/User';

const routes = new Router();

routes.get('/', async (req, res) => {
  const user = await User.create({
    name: 'Dwight Schrute',
    email: 'dwight.schrute@theoffice.com',
    password_hash: '123321',
  });
  return res.json(user);
});

export default routes;
