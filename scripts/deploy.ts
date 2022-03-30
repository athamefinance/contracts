import { ethers, upgrades } from 'hardhat';

async function main() {

  const [owner, feeCollector] = await ethers.getSigners();

  console.log('owner public address: ', owner.address);
  console.log('feeCollector public address: ', feeCollector.address);
  console.log();

  const treasuryFactory = await ethers.getContractFactory('AthameTreasury');
  const depositoryFactory = await ethers.getContractFactory('AthameDepository');
  const distributorFactory = await ethers.getContractFactory('AthameDistributor');

  // deploy treasury
  const treasury = await treasuryFactory.deploy();
  await treasury.deployed();
  const treasuryOwner = await treasury.owner();

  console.log('AthameTreasury owner:', treasuryOwner);
  console.log('AthameTreasury deployed to:', treasury.address);
  console.log();

  // deploy distributor
  const distributor = await distributorFactory.deploy(feeCollector.address);
  await distributor.deployed();
  const distributorOwner = await distributor.owner();

  console.log('AthameDistributor owner:', distributorOwner);
  console.log('AthameDistributor deployed to:', distributor.address);
  console.log();

  // deploy depository
  const depository = await depositoryFactory.deploy(treasury.address);
  const depositoryOwner = await depository.owner();

  console.log('AthameDepository owner:', depositoryOwner);
  console.log('AthameDepository deployed to:', depository.address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });