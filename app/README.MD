##Build the docker image


docker build -t sdnshakya-rearc .
docker tag sdnshakya-rearc:latest 460771252871.dkr.ecr.ap-south-1.amazonaws.com/rearc-quest:latest
docker push 460771252871.dkr.ecr.ap-south-1.amazonaws.com/rearc-quest:latest




cdk bootstrap 829813286297/ca-central-1 --profile rearc




##CDK Project


yarn install
yarn build
yarn cdk deploy --profile rearc
