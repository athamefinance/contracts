import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";
import { toFloat, chunkArray } from '../helper-functions';

describe('Athame Contract (depository)', function () {
  const TOTAL_TOKENS: number = 1000000;
  const LARGE_APPROVAL: string = "100000000000000000000000000";
  let mockTokenFactory: ContractFactory;
  let treasuryFactory: ContractFactory;
  let depositoryFactory: ContractFactory;
  let athameTokenFactory: ContractFactory;

  let owner: SignerWithAddress;
  let feeCollector: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let depository: Contract;
  let mockToken: Contract;
  let treasury: Contract;
  let athameToken: Contract;
  let depositorRole: number;
  let liquidityRole: number;
  let adminRole: number;

  before(async () => {
    [owner, feeCollector, alice, bob, carol] = await ethers.getSigners();

    athameTokenFactory = await ethers.getContractFactory('AthameToken');
    mockTokenFactory = await ethers.getContractFactory('Usd'); //18 or 6 decimals
    treasuryFactory = await ethers.getContractFactory('AthameTreasury');
    depositoryFactory = await ethers.getContractFactory('AthameDepository');
  });

  beforeEach(async function () {

    // deploy athame token    
    athameToken = await athameTokenFactory.deploy();
    await athameToken.deployed();

    console.log('Athame Token deployed to:', athameToken.address);

    // deploy mock token    
    mockToken = await mockTokenFactory.deploy();
    await mockToken.deployed();
    const decimals = await mockToken.decimals();
    const sharePrice = ethers.utils.parseUnits('10', decimals);

    console.log('Mock Token deployed to:', mockToken.address);

    // deploy treasury
    treasury = await treasuryFactory.deploy();
    await treasury.deployed();
    depositorRole = await treasury.DEPOSITOR();
    liquidityRole = await treasury.LIQUIDITYTOKEN();
    adminRole = await treasury.DEFAULT_ADMIN_ROLE();

    console.log('Treasury deployed to:', treasury.address);

    // deploy depository
    depository = await depositoryFactory.deploy(treasury.address,
      athameToken.address,
      mockToken.address,
      feeCollector.address,
      sharePrice); // 10 of chosen stable coin

    await athameToken.grantMinterRole(depository.address);
    await athameToken.grantRole(adminRole, depository.address);
    await athameToken.transferOwnership(depository.address);

    console.log('Depository deployed to:', depository.address);

    await mockToken.connect(owner).approve(depository.address, LARGE_APPROVAL);
    await mockToken.connect(alice).approve(depository.address, LARGE_APPROVAL);
    await mockToken.connect(bob).approve(depository.address, LARGE_APPROVAL);
    await mockToken.connect(carol).approve(depository.address, LARGE_APPROVAL);
  });

  describe('Deployment', function () {

    it('depository: should be paused', async function () {
      expect((await depository.paused())).to.equal(true);
    });

    it('depository: should be unpaused', async function () {
      await depository.unpause();
      expect((await depository.paused())).to.equal(false);
    });

    it('depository: should not be able to deposit', async function () {
      await expect(depository.buyShares(1)).to.be.revertedWith('Pausable: paused');
    });

    it("token: should assign the total supply of tokens to the owner", async function () {

      const ownerBalance = await mockToken.balanceOf(owner.address);
      expect(await mockToken.totalSupply()).to.equal(ownerBalance);
    });

    it("token: transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to feeCollector
      const decimals = await mockToken.decimals();
      await mockToken.transfer(feeCollector.address, ethers.utils.parseUnits('50', decimals));
      expect(await mockToken.balanceOf(feeCollector.address)).to.equal(ethers.utils.parseUnits('50', decimals));
    });

  });

  describe('Treasury', function () {

    it('treasury: Owner should be manager', async function () {
      expect((await treasury.hasRole(adminRole, owner.address))).to.equal(true);

      await treasury.grantRole(adminRole, feeCollector.address); // set second admin
      expect((await treasury.hasRole(adminRole, feeCollector.address))).to.equal(true);
    });

    it('treasury: Token should be liquidity token', async function () {
      await treasury.grantRole(liquidityRole, mockToken.address);
      expect((await treasury.hasRole(liquidityRole, mockToken.address))).to.equal(true);
    });

    it('treasury: Token should not be liquidity token', async function () {
      await treasury.grantRole(liquidityRole, mockToken.address); // on
      await treasury.revokeRole(liquidityRole, mockToken.address); // off
      expect((await treasury.hasRole(liquidityRole, mockToken.address))).to.equal(false);
    });

    it('treasury: Should not be able to deposit', async function () {
      expect(treasury.deposit(1000, mockToken.address)).to.be.revertedWith('Treasury: invalid token');
    });

  });

  describe('Depository', function () {

    it('Should be able to migrate', async function () {
      expect((await athameToken.hasRole(adminRole, depository.address))).to.equal(true);
      expect((await athameToken.owner())).to.equal(depository.address);

      // simulate a new depository contract
      await depository.migrate(owner.address);
      await athameToken.connect(owner).grantMinterRole(treasury.address);
      await athameToken.connect(owner).grantRole(adminRole, treasury.address);
      await athameToken.connect(owner).transferOwnership(treasury.address);

      const minterRole = await athameToken.MINTER_ROLE();

      expect((await athameToken.hasRole(minterRole, treasury.address))).to.equal(true);
      expect((await athameToken.hasRole(adminRole, treasury.address))).to.equal(true);
      expect((await athameToken.owner())).to.equal(treasury.address);
    });

    it('Should not be able to buy', async function () {
      await depository.unpause();

      const shares = 10000;

      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor

      expect(depository.connect(alice).buyShares(shares)).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should be able to deposit', async function () {
      await depository.unpause();

      const decimals = await mockToken.decimals();
      const sharePrice = toFloat(await depository.sharePrice(), decimals);
      const shares = 100;

      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor
      await depository.connect(owner).buyShares(shares); // buy shares from depository

      const expectedBalance = TOTAL_TOKENS - (shares * sharePrice);
      const expectedTreasuryBalance = shares * sharePrice;
      let [, userShareCount] = await depository.investors(owner.address);
      const treasuryDepositTokenBalance = toFloat(await mockToken.balanceOf(treasury.address), decimals);
      const treasuryBalance = toFloat(await treasury.totalReserves(), decimals);

      expect(toFloat(await mockToken.balanceOf(owner.address), decimals)).to.equal(expectedBalance);
      expect(treasuryDepositTokenBalance).to.equal(expectedTreasuryBalance);
      expect(treasuryBalance).to.equal(expectedTreasuryBalance);
      expect(Number(await depository.totalShareCount())).to.equal(shares);
      expect(userShareCount).to.equal(0); // not vested
    });

    it('Total contract share count should equal users share count', async function () {
      await depository.unpause();

      const decimals = await mockToken.decimals();

      await mockToken.transfer(alice.address, ethers.utils.parseUnits('1000', decimals));
      await mockToken.transfer(bob.address, ethers.utils.parseUnits('1000', decimals));
      await mockToken.transfer(carol.address, ethers.utils.parseUnits('1000', decimals));

      const shares = 1;
      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor
      await depository.connect(alice).buyShares(shares); // buy shares from depository
      await depository.connect(bob).buyShares(shares); // buy shares from depository
      await depository.connect(carol).buyShares(shares); // buy shares from depository

      expect(Number(await depository.totalShareCount())).to.equal(shares * 3);
    });

    it('Should have athame tokens', async function () {
      await depository.unpause();

      const decimals = await athameToken.decimals();
      const shares = 100;

      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor
      await depository.connect(owner).buyShares(shares); // buy shares from depository
      expect(toFloat(await athameToken.balanceOf(owner.address), decimals)).to.equal(shares);
    });

    it('Deposit fee', async function () {
      await depository.unpause();

      const decimals = await mockToken.decimals();

      await mockToken.transfer(alice.address, ethers.utils.parseUnits('1000', decimals));

      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor

      const rewards = 100;
      const fee = toFloat(await depository.fee(), decimals) * 1000;
      await depository.deposit(rewards);
      const totalUnclaimed = await depository.totalUnclaimed();
      const finalAmount = rewards - (rewards * fee);
      expect(Number(totalUnclaimed)).to.equal(finalAmount);
    });

    it('Should be able to claim', async function () {
      await depository.unpause();

      const decimals = await mockToken.decimals();

      await mockToken.transfer(alice.address, ethers.utils.parseUnits('1000', decimals));
      await mockToken.transfer(bob.address, ethers.utils.parseUnits('1000', decimals));
      await mockToken.transfer(carol.address, ethers.utils.parseUnits('1000', decimals));

      await treasury.grantRole(liquidityRole, mockToken.address); // set liquidity token
      await treasury.grantRole(depositorRole, depository.address); // set depositor
      await depository.connect(alice).buyShares(2); // buy shares from depository
      const aliceBalance = await mockToken.balanceOf(alice.address)
      await depository.connect(bob).buyShares(3); // buy shares from depository
      await depository.connect(carol).buyShares(4); // buy shares from depository

      // move forward 7 days
      await ethers.provider.send("evm_increaseTime", [604800]); // 86400 seconds per day
      await ethers.provider.send("evm_mine", []);

      const rewards = 10000;

      // 1 get account length
      const accountsLength = await depository.getAccountCount();

      // 2 update shares
      for (let index = 0; index < accountsLength; index++) {
        const add = await depository.getAccountAtIndex(index);
        const indexes = await depository.indexesFor(add);

        await depository.updateInvestorShares(add, indexes);
      }

      const vested = await depository.getVestedShares();
      expect(Number(vested)).to.equal(9);

      // 3 deposit
      await depository.deposit(rewards);

      // 4 
      const rewardPerShare = Number(await depository.getRewardPerShare(rewards));
      expect(Number(rewardPerShare)).to.equal(1000);

      // 5 
      for (let index = 0; index < accountsLength; index++) {
        const add = await depository.getAccountAtIndex(index);
        await depository.updateInvestorDividends(add, rewardPerShare);
      }

      const fee = toFloat(await depository.fee(), decimals) * 1000;
      const totalUnclaimed = await depository.totalUnclaimed();
      const finalAmount = rewards - (rewards * fee);

      expect(Number(totalUnclaimed)).to.equal(finalAmount);

      // Reward per share
      const expectedBalance = Number(aliceBalance) + rewardPerShare * 2;
      let [, , dividends] = await depository.investors(alice.address);

      expect(Number(dividends)).to.equal(rewardPerShare * 2);

      await depository.connect(alice).claim();

      [, , dividends] = await depository.investors(alice.address);

      expect(Number(dividends)).to.equal(0);
      expect(Number(await mockToken.balanceOf(alice.address))).to.equal(expectedBalance);

    });
  });

});