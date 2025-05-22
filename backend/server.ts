import express, { Request, Response } from 'express';
import { Sequelize, DataTypes, Op } from 'sequelize';
import * as k8s from '@kubernetes/client-node';
import cron from 'node-cron';
import bcrypt from 'bcrypt';

interface UserAttributes {
  subdomain: string;
  username: string;
  password_hash: string;
  last_login: Date;
  cr_name: string;
}

const app = express();
app.use(express.json());

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@postgres:5432/uptimekuma_db', {
  logging: false,
});
const k8sConfig = new k8s.KubeConfig();
k8sConfig.loadFromDefault();
const k8sCustomApi = k8sConfig.makeApiClient(k8s.CustomObjectsApi);
const k8sApi = k8sConfig.makeApiClient(k8s.CoreV1Api);

const User = sequelize.define('User', {
  subdomain: { type: DataTypes.STRING, unique: true, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  last_login: { type: DataTypes.DATE, allowNull: false },
  cr_name: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: false });

sequelize.sync();

app.post('/create-account', async (req: Request, res: Response) => {
  const { subdomain, username, password }: { subdomain: string; username: string; password: string } = req.body;
  try {
    if (!subdomain || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      subdomain,
      username,
      password_hash,
      last_login: new Date(),
      cr_name: `uptimekuma-${subdomain}`,
    }) as UserAttributes;

    const secretName = `uptimekuma-${subdomain}-creds`;
    const secret: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: secretName, namespace: 'utkaas' },
      data: {
        username: Buffer.from(username).toString('base64'),
        password: Buffer.from(password).toString('base64'),
      },
    };
    await k8sApi.createNamespacedSecret('utkaas', secret);

    const cr = {
      apiVersion: 'uptimekuma.example.com/v1',
      kind: 'UptimeKumaInstance',
      metadata: { name: user.cr_name, namespace: 'utkaas' },
      spec: { subdomain, credentialsSecret: secretName, replicas: 1 },
    };
    await k8sCustomApi.createNamespacedCustomObject(
      'uptimekuma.example.com',
      'v1',
      'utkaas',
      'uptimekumainstances',
      cr
    );

    res.status(201).json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ message: 'Error creating account' });
  }
});

// Timer to check for inactive users (runs daily at midnight)
cron.schedule('0 0 * * *', async () => {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const inactive3Months = await User.findAll({
    where: { last_login: { [Op.lt]: threeMonthsAgo } },
  }) as UserAttributes[];
  for (const user of inactive3Months) {
    try {
      const cr = await k8sCustomApi.getNamespacedCustomObject(
        'uptimekuma.example.com',
        'v1',
        'utkaas',
        'uptimekumainstances',
        user.cr_name
      );
      if (cr.body.spec.replicas !== 0) {
        await k8sCustomApi.patchNamespacedCustomObject(
          'uptimekuma.example.com',
          'v1',
          'utkaas',
          'uptimekumainstances',
          user.cr_name,
          { spec: { replicas: 0 } },
          undefined,
          undefined,
          undefined,
          { headers: { 'Content-Type': 'application/merge-patch+json' } }
        );
        console.log(`Scaled ${user.cr_name} to zero replicas`);
      }
    } catch (error) {
      console.error(`Error scaling ${user.cr_name}:`, error);
    }
  }

  const inactive1Year = await User.findAll({
    where: { last_login: { [Op.lt]: oneYearAgo } },
  }) as UserAttributes[];
  for (const user of inactive1Year) {
    try {
      await k8sCustomApi.deleteNamespacedCustomObject(
        'uptimekuma.example.com',
        'v1',
        'utkaas',
        'uptimekumainstances',
        user.cr_name
      );
      await User.destroy({ where: { cr_name: user.cr_name } });
      console.log(`Deleted ${user.cr_name} and user data`);
    } catch (error) {
      console.error(`Error deleting ${user.cr_name}:`, error);
    }
  }
});

app.listen(3000, () => console.log('Backend running on port 3000'));