import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-gas-reporter';
import * as dotenv from 'dotenv';
import 'hardhat-deploy';
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from 'hardhat/config';

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: process.env.DEFAULT_NETWORK,
  networks: {
    hardhat: {
    },
    network: {
      url: process.env.API_URL,
      chainId: Number(process.env.CHAIN_ID)
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    feeCollector: {
      default: 1,
    }
  },
  solidity: '0.8.13',
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  paths: {
    deploy: "./scripts/deploy"
},
};

export default config;