/**
 * Class that can be used to log events to a central repro. 
 */

 import * as core from "@actions/core"
 import * as context from "@actions/github"

import axios from "axios"

import { Command } from "../eventProcessor";

 export class EventLogger {

    key : string;
    slug : string;

    constructor(key : string, slug : string) {
        this.key = key;
        this.slug = slug;
    }

    public static getInstance() : EventLogger {
        const logKey = core.getInput("LOG_KEY");

        const slug = `${context.context.repo.owner}/${context.context.repo.repo}`;

        if(logKey === "") {
            core.error("No log key read");
            core.setFailed("No LOG_KEY was read from the input.");
            throw new Error("No key read");
        }
        
        return new EventLogger(logKey, slug);
    }

    /**
     * Given a command, it is persisted to the server. 
     * @param command The command that should be logged.
     */
    public async LogCommand(command : Command) : Promise<void> {

        if(command === null) {
            core.error("Empty object passed to logger");
            return;
        }

        try {
            let res = await axios.put("https://toxic.research.cassee.dev/log", command, { params: { key: this.key, slug: this.slug}} );

            core.debug("Logged processed command");
        } catch(err) {
            if(err.name === "Error") {
                core.info(JSON.stringify(err))
                core.setFailed("Could not reach log API")
                throw new Error("Could not reach log API");
            } else {
                core.error(JSON.stringify(err));
                core.setFailed("Invalid response from log API")
            }
        }
    }
 }