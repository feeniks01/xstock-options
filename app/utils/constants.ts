import { PublicKey } from "@solana/web3.js";

export interface XStock {
    symbol: string;
    name: string;
    mint: PublicKey;
    logo?: string;
    priceMint?: PublicKey; // Mainnet mint address for fetching real price data from Bitquery
}

// xStock mint for on-chain operations
export const MOCK_MINT = new PublicKey("D6wYCkoFg1PyQn1fX21Vv2Z1h1M5oSSK26AHtRvahdTB");

// USDC mint for on-chain operations
export const QUOTE_MINT = new PublicKey("EnDeaApTGfsWxMwLbmJsTh1gSLVR8gJG26dqoDjfPVag");
export const QUOTE_LOGO = "/usdc_logo.png"; // Local USDC logo

// Real NVDAx mainnet mint for price data
export const NVDA_MAINNET_MINT = new PublicKey("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh");

export const XSTOCKS_DEVNET: XStock[] = [
    {
        symbol: "NVDAx",
        name: "NVIDIA xStock",
        mint: MOCK_MINT, // Devnet mock mint for on-chain operations
        priceMint: NVDA_MAINNET_MINT, // Real NVDAx for Bitquery price data
        logo: "/nvidiax_logo.png" // Local asset
    }
];

export const XSTOCKS_MAINNET: XStock[] = [
    {
        symbol: "ABTx",
        name: "Abbott xStock",
        mint: new PublicKey("XsHtf5RpxsQ7jeJ9ivNewouZKJHbPxhPoEy6yYvULr7"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf6359f8fa1d916afe97b_Ticker%3DABT%2C%20Company%20Name%3DAbbot%2C%20size%3D256x256.svg"
    },
    {
        symbol: "ABBVx",
        name: "AbbVie xStock",
        mint: new PublicKey("XswbinNKyPmzTa5CskMbCPvMW6G5CMnZXZEeQSSQoie"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be7c58986cdaeeee5bbba_Ticker%3DABBV%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "ACNx",
        name: "Accenture xStock",
        mint: new PublicKey("Xs5UJzmCRQ8DWZjskExdSQDnbE6iLkRu2jjrRAB1JSU"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0b0e15af8be8257db52f_Ticker%3DACN%2C%20Company%20Name%3Daccenture%2C%20size%3D256x256.svg"
    },
    {
        symbol: "GOOGLx",
        name: "Alphabet xStock",
        mint: new PublicKey("XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aae04a3d8452e0ae4bad8_Ticker%3DGOOG%2C%20Company%20Name%3DAlphabet%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "AMZNx",
        name: "Amazon xStock",
        mint: new PublicKey("Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497d354d7140b01657a793_Ticker%3DAMZN%2C%20Company%20Name%3DAmazon.com%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "AMBRx",
        name: "Amber xStock",
        mint: new PublicKey("XsaQTCgebC2KPbf27KUhdv5JFvHhQ4GDAPURwrEhAzb"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68652e463fd5d0c86d866c65_AMBRx.svg"
    },
    {
        symbol: "AAPLx",
        name: "Apple xStock",
        mint: new PublicKey("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6849799260ee65bf38841f90_Ticker%3DAAPL%2C%20Company%20Name%3DApple%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "APPx",
        name: "AppLovin xStock",
        mint: new PublicKey("XsPdAVBi8Zc1xvv53k4JcMrQaEDTgkGqKYeh7AYgPHV"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0deccaecf631c0c174ea_Ticker%3DAPP%2C%20Company%20Name%3Dapp%20lovin%2C%20size%3D256x256.svg"
    },
    {
        symbol: "AZNx",
        name: "AstraZeneca xStock",
        mint: new PublicKey("Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf47b066fa1085ae953e9_Ticker%3DAZN%2C%20Company%20Name%3Dastrazeneca%2C%20size%3D256x256.svg"
    },
    {
        symbol: "BACx",
        name: "Bank of America xStock",
        mint: new PublicKey("XswsQk4duEQmCbGzfqUUWYmi7pV7xpJ9eEmLHXCaEQP"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf5a74604b4f162fd0efd_Ticker%3DBAC%2C%20Company%20Name%3DBank%20of%20America%20Corporation%2C%20size%3D256x256.svg"
    },
    {
        symbol: "BRK.Bx",
        name: "Berkshire Hathaway xStock",
        mint: new PublicKey("Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ab977b76d1a151f09c858_Ticker%3DBRK.B%2C%20Company%20Name%3Dberkshire-hathaway%2C%20size%3D256x256.svg"
    },
    {
        symbol: "AVGOx",
        name: "Broadcom xStock",
        mint: new PublicKey("XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaef288f41927892d12c1_Ticker%3DAVGO%2C%20Company%20Name%3DBroadcom%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "CVXx",
        name: "Chevron xStock",
        mint: new PublicKey("XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be50accfbb14c64319124_Ticker%3DCVX%2C%20Company%20Name%3Dchevron%2C%20size%3D256x256.svg"
    },
    {
        symbol: "CRCLx",
        name: "Circle xStock",
        mint: new PublicKey("XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6861ae6944c62c8dd3a0e165_CRCLx.svg"
    },
    {
        symbol: "CSCOx",
        name: "Cisco xStock",
        mint: new PublicKey("Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bec77bfaeef7ac61f7231_Ticker%3DCSCO%2C%20Company%20Name%3DCisco%20Systems%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "KOx",
        name: "Coca-Cola xStock",
        mint: new PublicKey("XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684beb344604b4f162f66f93_Ticker%3DCOKE%2C%20Company%20Name%3DCokeCola%2C%20size%3D256x256.svg"
    },
    {
        symbol: "COINx",
        name: "Coinbase xStock",
        mint: new PublicKey("Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c131b2d6d8cbe9e61a3dc_Ticker%3DCOIN%2C%20Company%20Name%3DCoinbase%2C%20size%3D256x256.svg"
    },
    {
        symbol: "CMCSAx",
        name: "Comcast xStock",
        mint: new PublicKey("XsvKCaNsxg2GN8jjUmq71qukMJr7Q1c5R2Mk9P8kcS8"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bfbe3db57e5f5f6b277aa_Ticker%3DCMCSA%2C%20Company%20Name%3DComcast%2C%20size%3D256x256.svg"
    },
    {
        symbol: "CRWDx",
        name: "CrowdStrike xStock",
        mint: new PublicKey("Xs7xXqkcK7K8urEqGg52SECi79dRp2cEKKuYjUePYDw"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c10fbaf9d90e3d974ae23_Ticker%3DCRWD%2C%20Company%20Name%3DCrowdstrike%2C%20size%3D256x256.svg"
    },
    {
        symbol: "DHRx",
        name: "Danaher xStock",
        mint: new PublicKey("Xseo8tgCZfkHxWS9xbFYeKFyMSbWEvZGFV1Gh53GtCV"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bfa59ce8102ff96cee2fe_Ticker%3DDHR%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "DFDVx",
        name: "DFDV xStock",
        mint: new PublicKey("Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/6861b8b7beb9cf856e2332d5_DFDVx.svg"
    },
    {
        symbol: "LLYx",
        name: "Eli Lilly xStock",
        mint: new PublicKey("Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ad0eaa9a1efe9b1b7155a_Ticker%3DLLY%2C%20Company%20Name%3DLilly%2C%20size%3D256x256.svg"
    },
    {
        symbol: "XOMx",
        name: "Exxon Mobil xStock",
        mint: new PublicKey("XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684abe960ee12e238c0a1f0b_Ticker%3DXOM%2C%20Company%20Name%3DExxonMobil%2C%20size%3D256x256.svg"
    },
    {
        symbol: "GMEx",
        name: "Gamestop xStock",
        mint: new PublicKey("Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c125f1c48a3dab4c66137_Ticker%3DGME%2C%20Company%20Name%3Dgamestop%2C%20size%3D256x256.svg"
    },
    {
        symbol: "GLDx",
        name: "Gold xStock",
        mint: new PublicKey("Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685123a7747987b071b10d47_Ticker%3DGLD%2C%20Company%20Name%3DGold%2C%20size%3D256x256.svg"
    },
    {
        symbol: "GSx",
        name: "Goldman Sachs xStock",
        mint: new PublicKey("XsgaUyp4jd1fNBCxgtTKkW64xnnhQcvgaxzsbAq5ZD1"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c114972ed2d868a1b3f95_Ticker%3DGS%2C%20Company%20Name%3DGoldman%20Sachs%2C%20size%3D256x256.svg"
    },
    {
        symbol: "HDx",
        name: "Home Depot xStock",
        mint: new PublicKey("XszjVtyhowGjSC5odCqBpW1CtXXwXjYokymrk7fGKD3"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be484171c0a11201e098d_Ticker%3DHD%2C%20Company%20Name%3DHome%20Depot%2C%20size%3D256x256.svg"
    },
    {
        symbol: "HONx",
        name: "Honeywell xStock",
        mint: new PublicKey("XsRbLZthfABAPAfumWNEJhPyiKDW6TvDVeAeW7oKqA2"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c08d12385ea1da806a5bb_Ticker%3DHON%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "INTCx",
        name: "Intel xStock",
        mint: new PublicKey("XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0a334cac334b4a41651b_Ticker%3DINTC%2C%20Company%20Name%3DIntel%20Corp%2C%20size%3D256x256.svg"
    },
    {
        symbol: "IBMx",
        name: "International Business Machines xStock",
        mint: new PublicKey("XspwhyYPdWVM8XBHZnpS9hgyag9MKjLRyE3tVfmCbSr"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bfb32f7000e98d733283f_Ticker%3DIBM%2C%20Company%20Name%3DIBM%2C%20size%3D256x256.svg"
    },
    {
        symbol: "JNJx",
        name: "Johnson & Johnson xStock",
        mint: new PublicKey("XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ace98941130a24503a315_Ticker%3DJNJ%2C%20Company%20Name%3Djohnson-johnson%2C%20size%3D256x256.svg"
    },
    {
        symbol: "JPMx",
        name: "JPMorgan Chase xStock",
        mint: new PublicKey("XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684acf34c10a7e0add155c61_Ticker%3DJPM%2C%20Company%20Name%3DJPMorganChase%2C%20size%3D256x256.svg"
    },
    {
        symbol: "LINx",
        name: "Linde xStock",
        mint: new PublicKey("XsSr8anD1hkvNMu8XQiVcmiaTP7XGvYu7Q58LdmtE8Z"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf2b1132313f4529a3160_Ticker%3DLIN%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MRVLx",
        name: "Marvell xStock",
        mint: new PublicKey("XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0eb412d3850c2c01cd29_Ticker%3DMRVL%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MAx",
        name: "Mastercard xStock",
        mint: new PublicKey("XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684ad1ca13c7aaa9ece4cbbf_Ticker%3DMA%2C%20Company%20Name%3DMastercard%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MCDx",
        name: "McDonald's xStock",
        mint: new PublicKey("XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf77838b45bb94ff32be7_Ticker%3DMCD%2C%20Company%20Name%3DMcDonalds%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MDTx",
        name: "Medtronic xStock",
        mint: new PublicKey("XsDgw22qRLTv5Uwuzn6T63cW69exG41T6gwQhEK22u2"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bfc99a86580de629510e9_Ticker%3DMDT%2C%20Company%20Name%3DMedtronic%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MRKx",
        name: "Merck xStock",
        mint: new PublicKey("XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be6ff5bd0a5643adf85ec_Ticker%3DMRK%2C%20Company%20Name%3DMerck%2C%20size%3D256x256.svg"
    },
    {
        symbol: "METAx",
        name: "Meta xStock",
        mint: new PublicKey("Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497dee3db1bae97b91ac05_Ticker%3DMETA%2C%20Company%20Name%3DMeta%20Platforms%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MSFTx",
        name: "Microsoft xStock",
        mint: new PublicKey("XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68497bdc918924ea97fd8211_Ticker%3DMSFT%2C%20Company%20Name%3DMicrosoft%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "MSTRx",
        name: "MicroStrategy xStock",
        mint: new PublicKey("XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0d47eee3a9c3fa12475a_Ticker%3DMSTR%2C%20Company%20Name%3DMicroStrategy%2C%20size%3D256x256.svg"
    },
    {
        symbol: "QQQx",
        name: "Nasdaq xStock",
        mint: new PublicKey("Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68511cb6e367f19f06664527_QQQx.svg"
    },
    {
        symbol: "NFLXx",
        name: "Netflix xStock",
        mint: new PublicKey("XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf6c149d917d503f6cda6_Ticker%3DNFLX%2C%20Company%20Name%3DNetflix%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "NVOx",
        name: "Novo Nordisk xStock",
        mint: new PublicKey("XsfAzPzYrYjd4Dpa9BU3cusBsvWfVB9gBcyGC87S57n"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf139788d618501b65727_Ticker%3DNOVO_B%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "OPENx",
        name: "OPEN xStock",
        mint: new PublicKey("XsGtpmjhmC8kyjVSWL4VicGu36ceq9u55PTgF8bhGv6"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/688cb3ec1f3801d9bc17729e_Ticker%3DOPENx%2C%20Company%20Name%3DOpendoor%2C%20Size%3D32x32.svg"
    },
    {
        symbol: "ORCLx",
        name: "Oracle xStock",
        mint: new PublicKey("XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf1ecae4eb4a817da9941_Ticker%3DORCL%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "PLTRx",
        name: "Palantir xStock",
        mint: new PublicKey("XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0c4c0e5466272c52958b_Ticker%3DPLTR%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "PEPx",
        name: "PepsiCo xStock",
        mint: new PublicKey("Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be8662b90a208c5d5b8e5_Ticker%3DPEP%2C%20Company%20Name%3DPepsico%2C%20size%3D256x256.svg"
    },
    {
        symbol: "PFEx",
        name: "Pfizer xStock",
        mint: new PublicKey("XsAtbqkAP1HJxy7hFDeq7ok6yM43DQ9mQ1Rh861X8rw"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be5e3c54ff3f5c6c9b36f_Ticker%3DPFE%2C%20Company%20Name%3Dpfizer%2C%20size%3D256x256.svg"
    },
    {
        symbol: "PMx",
        name: "Philip Morris xStock",
        mint: new PublicKey("Xsba6tUnSjDae2VcopDB6FGGDaxRrewFCDa5hKn5vT3"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0981cbec78a581a6bfe7_Ticker%3DPM%2C%20Company%20Name%3Dphilip%20morris%2C%20size%3D256x256.svg"
    },
    {
        symbol: "PGx",
        name: "Procter & Gamble xStock",
        mint: new PublicKey("XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684be3c6fa6a62fb260a51e3_Ticker%3DPG%2C%20Company%20Name%3DProctor%20%26%20Gamble%2C%20size%3D256x256.svg"
    },
    {
        symbol: "HOODx",
        name: "Robinhood xStock",
        mint: new PublicKey("XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684c0f39cede10b9afa4852f_Ticker%3DHOOD%2C%20Company%20Name%3DRobinhood%2C%20size%3D256x256.svg"
    },
    {
        symbol: "CRMx",
        name: "Salesforce xStock",
        mint: new PublicKey("XsczbcQ3zfcgAEt9qHQES8pxKAVG5rujPSHQEXi4kaN"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf3670e24ef4c92a6a7fc_Ticker%3DCRM%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "SPYx",
        name: "SP500 xStock",
        mint: new PublicKey("XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685116624ae31d5ceb724895_Ticker%3DSPX%2C%20Company%20Name%3DSP500%2C%20size%3D256x256.svg"
    },
    {
        symbol: "TBLLx",
        name: "TBLL xStock",
        mint: new PublicKey("XsqBC5tcVQLYt8wqGCHRnAUUecbRYXoJCReD6w7QEKp"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/688cb5a681cc1775c4cd3cae_Ticker%3DTBLLx%2C%20Company%20Name%3DInvesco%2C%20Size%3D32x32.svg"
    },
    {
        symbol: "TSLAx",
        name: "Tesla xStock",
        mint: new PublicKey("XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684aaf9559b2312c162731f5_Ticker%3DTSLA%2C%20Company%20Name%3DTesla%20Inc.%2C%20size%3D256x256.svg"
    },
    {
        symbol: "TMOx",
        name: "Thermo Fisher xStock",
        mint: new PublicKey("Xs8drBWy3Sd5QY3aifG9kt9KFs2K3PGZmx7jWrsrk57"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bf4d930b0fdc50503056d_Ticker%3DTMO%2C%20Company%20Name%3DThermo_Fisher_Scientific%2C%20size%3D256x256.svg"
    },
    {
        symbol: "TONXx",
        name: "TON xStock",
        mint: new PublicKey("XscE4GUcsYhcyZu5ATiGUMmhxYa1D5fwbpJw4K6K4dp"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68d7db29223cfd256ebb952c_Ticker%3DTONx%2C%20Company%20Name%3DTON%2C%20Size%3D32x32.svg"
    },
    {
        symbol: "TQQQx",
        name: "TQQQ xStock",
        mint: new PublicKey("XsjQP3iMAaQ3kQScQKthQpx9ALRbjKAjQtHg6TFomoc"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/685125548a5829b9b59a6156_TQQQx.svg"
    },
    {
        symbol: "UNHx",
        name: "UnitedHealth xStock",
        mint: new PublicKey("XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684abb4c69185d8a871e2ab5_Ticker%3DUNH%2C%20Company%20Name%3DUnited%20Health%2C%20size%3D256x256.svg"
    },
    {
        symbol: "VTIx",
        name: "Vanguard xStock",
        mint: new PublicKey("XsssYEQjzxBCFgvYFFNuhJFBeHNdLWYeUSP8F45cDr9"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/68511e335ee1314f602d9a7c_Ticker%3DVTI%2C%20Company%20Name%3DVanguard%2C%20size%3D256x256.svg"
    },
    {
        symbol: "Vx",
        name: "Visa xStock",
        mint: new PublicKey("XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684acfd76eb8395c6d1d2210_Ticker%3DV%2C%20Company%20Name%3DVisa%2C%20size%3D256x256.svg"
    },
    {
        symbol: "WMTx",
        name: "Walmart xStock",
        mint: new PublicKey("Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci"),
        logo: "https://cdn.prod.website-files.com/655f3efc4be468487052e35a/684bebd366d5089b2da3cf7e_Ticker%3DWMT%2C%20Company%20Name%3DWalmart%2C%20size%3D256x256.svg"
    }
];

// Combine lists with mock first, then all mainnet stocks
export const XSTOCKS: XStock[] = [
    ...XSTOCKS_DEVNET, // Mock xStock first
    ...XSTOCKS_MAINNET // All real xStocks
];
