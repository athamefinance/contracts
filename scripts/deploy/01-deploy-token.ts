import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../../constants";

const deployAthameToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log("----------------------------------------------------");
    log("Deploying Athame Token and waiting for confirmations...");

    const result = await deploy(CONTRACTS.ath, {
        from: deployer,
        args: [],
        log: true,
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: 1
    });

    log(`Athame Token at ${result.address}`);

};

export default deployAthameToken;
deployAthameToken.tags = [CONTRACTS.ath, "all"];
