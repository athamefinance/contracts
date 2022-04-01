import { ethers } from 'hardhat';

async function main() {

    const LARGE_APPROVAL: string = "100000000000000000000000000";
    const [owner, feeCollector] = await ethers.getSigners();

    console.log('owner public address: ', owner.address);
    console.log('feeCollector public address: ', feeCollector.address);
    console.log();

    const athameTokenFactory = await ethers.getContractFactory('AthameToken');
    const mockTokenFactory = await ethers.getContractFactory('Usd');
    const treasuryFactory = await ethers.getContractFactory('AthameTreasury');
    const depositoryFactory = await ethers.getContractFactory('AthameDepository');

    // deploy athame token
    const athameToken = await athameTokenFactory.deploy();
    await athameToken.deployed();

    console.log('AthameToken deployed to:', athameToken.address);
    console.log();

    // deploy dai token
    const mockToken = await mockTokenFactory.deploy();
    await mockToken.deployed();
    const decimals = await mockToken.decimals();
    const sharePrice = ethers.utils.parseUnits('10', decimals);

    console.log('Deposit token mock deployed to:', mockToken.address);
    console.log();

    // deploy treasury
    const treasury = await treasuryFactory.deploy();
    await treasury.deployed();

    console.log('AthameTreasury deployed to:', treasury.address);
    console.log();

    // deploy depository
    const depository = await depositoryFactory.deploy(treasury.address, 
        athameToken.address, 
        mockToken.address, 
        feeCollector.address,
        sharePrice);
    await depository.deployed();

    console.log('AthameDepository deployed to:', depository.address);
    console.log();

    const depositorRole = await treasury.DEPOSITOR();
    const liquidityRole = await treasury.LIQUIDITYTOKEN();

    // these need to be run before accepting investors
    await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
    await treasury.grantRole(depositorRole, depository.address); // set depositor
    await athameToken.grantMinterRole(depository.address); // set minter role
    await depository.unpause(); // then unpause

    await mockToken.transfer(feeCollector.address, ethers.utils.parseUnits('5000', decimals));

    await mockToken.connect(owner).approve(depository.address, LARGE_APPROVAL);
    await mockToken.connect(feeCollector).approve(depository.address, LARGE_APPROVAL);

    await depository.connect(owner).buyShares(2000);

    // move forward 7 days
    await ethers.provider.send("evm_increaseTime", [604800]); // 86400 seconds per day
    await ethers.provider.send("evm_mine", []);

    // should not be vested
    await depository.connect(feeCollector).buyShares(233);
    await treasury.withdraw(ethers.utils.parseUnits('5000', decimals), mockToken.address);
    await depository.deposit(ethers.utils.parseUnits('1000', decimals));

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });