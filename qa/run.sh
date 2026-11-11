#!/bin/zsh
export PUPPETEER_MODULE=${PUPPETEER_MODULE:-$HOME/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer}
cd ${0:A:h}/.. && node qa/e2e.cjs
