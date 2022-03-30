import { ethers } from 'hardhat';

async function main() {

    const LARGE_APPROVAL: string = "100000000000000000000000000";
    const [owner, feeCollector] = await ethers.getSigners();

    console.log('owner public address: ', owner.address);
    console.log('feeCollector public address: ', feeCollector.address);
    console.log();

    const athameTokenFactory = await ethers.getContractFactory('AthameToken');
    const daitokenFactory = await ethers.getContractFactory('Dai');
    const treasuryFactory = await ethers.getContractFactory('AthameTreasury');
    const depositoryFactory = await ethers.getContractFactory('AthameDepository');

    // deploy athame token
    const athameToken = await athameTokenFactory.deploy();
    await athameToken.deployed();

    console.log('AthameToken deployed to:', athameToken.address);
    console.log();

    // deploy dai token
    const daitoken = await daitokenFactory.deploy();
    await daitoken.deployed();

    console.log('Dai mock token deployed to:', daitoken.address);
    console.log();

    // deploy treasury
    const treasury = await treasuryFactory.deploy();
    await treasury.deployed();

    console.log('AthameTreasury deployed to:', treasury.address);
    console.log();

    // deploy depository
    const depository = await depositoryFactory.deploy(treasury.address, athameToken.address, daitoken.address, feeCollector.address);
    await depository.deployed();

    console.log('AthameDepository deployed to:', depository.address);
    console.log();

    const depositorRole = await treasury.DEPOSITOR();
    const liquidityRole = await treasury.LIQUIDITYTOKEN();

    // these need to be run before accepting investors
    await treasury.grantRole(liquidityRole, daitoken.address); // set liquidity token
    await treasury.grantRole(depositorRole, depository.address); // set depositor
    await athameToken.grantMinterRole(depository.address); // set minter role
    await depository.unpause(); // then unpause

    await daitoken.transfer(feeCollector.address, ethers.utils.parseUnits('5000', 18));

    await daitoken.connect(owner).approve(depository.address, LARGE_APPROVAL);
    await daitoken.connect(feeCollector).approve(depository.address, LARGE_APPROVAL);

    await depository.connect(owner).buyShares(2000);

    // move forward 7 days
    await ethers.provider.send("evm_increaseTime", [604800]); // 86400 seconds per day
    await ethers.provider.send("evm_mine", []);

    // should not be vested
    await depository.connect(feeCollector).buyShares(233);

    await treasury.withdraw(ethers.utils.parseUnits('5000', 18), daitoken.address);
    await depository.deposit(ethers.utils.parseUnits('1000', 18));

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });