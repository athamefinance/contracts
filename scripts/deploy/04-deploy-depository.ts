import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../../constants";
import { ethers } from "hardhat";

const deployConfigure: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments } = hre;
    const { log } = deployments;
    const treasury = await deployments.get(CONTRACTS.treasury);
    const depository = await deployments.get(CONTRACTS.depository);
    const depositoryContract = await ethers.getContractAt(CONTRACTS.depository, depository.address);
    const treasuryContract = await ethers.getContractAt(CONTRACTS.treasury, treasury.address);
    const athameToken = await deployments.get(CONTRACTS.ath);
    const athameTokenContract = await ethers.getContractAt(CONTRACTS.ath, athameToken.address);
    const daiAddress = process.env.DAI_ADDRESS;

    log("----------------------------------------------------");
    log("Configuring Athame Contracts...");

    const depositorRole = await treasuryContract.DEPOSITOR();
    const liquidityRole = await treasuryContract.LIQUIDITYTOKEN();

    // these need to be run before accepting investors
    log("Granting liquidityRole role to ", daiAddress);
    await treasuryContract.grantRole(liquidityRole, daiAddress); // set liquidity token
    log("Granting depositorRole role to ", depository.address);
    await treasuryContract.grantRole(depositorRole, depository.address); // set depositor
    log("Granting minter role to ", depository.address);
    await athameTokenContract.grantMinterRole(depository.address); // set minter role
    log("unpausing");
    await depositoryContract.unpause(); // then unpause

    log("Done Configuring");
};

export default deployConfigure;
deployConfigure.tags = ["Configure", "all"];