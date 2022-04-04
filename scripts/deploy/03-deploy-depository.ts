import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "ethers";
import { CONTRACTS } from "../../constants";

const deployAthameDepository: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer, feeCollector } = await getNamedAccounts();
    const treasury = await deployments.get(CONTRACTS.treasury);
    const athameToken = await deployments.get(CONTRACTS.ath);
    const depositTokenAddress = process.env.DEPOSIT_TOKEN_ADDRESS;

    const sharePrice = ethers.utils.parseUnits('10', 6);

    log("----------------------------------------------------");
    log("Deploying Athame Depository and waiting for confirmations...");

    const result = await deploy(CONTRACTS.depository, {
        from: deployer,
        args: [treasury.address, athameToken.address, depositTokenAddress, feeCollector, sharePrice],
        log: true,
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: 1
    });

    log(`Athame Depository at ${result.address}`);

};

export default deployAthameDepository;
deployAthameDepository.tags = [CONTRACTS.depository, "all"];