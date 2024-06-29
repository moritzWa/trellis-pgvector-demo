import axios from "axios";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import OpenAI from "openai";
import * as path from "path";
import * as pgvector from "pgvector";
import { QueryFailedError } from "typeorm";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";
import {
  EmailTransformationResult,
  transformationParams,
} from "../tranformations/EmailTranformation";
const FormData = require("form-data");

export class EmailExtractionController {
  private emailExtractionRepository =
    AppDataSource.getRepository(EmailExtraction);

  // upload

  async uploadEmailAssets(request: Request, response: Response) {
    const { projectName } = request.body;

    const batchSize = 2;
    const directoryPath = path.join(__dirname, "..", "assets");
    const allFiles = fs
      .readdirSync(directoryPath)
      .filter((file) => !file.startsWith("."));
    let allAssetIds = [];

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batchFiles = allFiles.slice(i, i + batchSize);
      const formData = new FormData();

      batchFiles.forEach((file) => {
        const extId = file.replace(".txt", "");
        formData.append(
          "files",
          fs.createReadStream(path.join(directoryPath, file))
        );
        formData.append("ext_ids", extId);
        formData.append("ext_file_names", file);
        formData.append("file_types", "txt");
      });

      formData.append("proj_name", projectName);

      try {
        const res = await axios.post(
          "https://api.usetrellis.co/v1/assets/upload/",
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Accept: "application/json",
              Authorization: process.env.TRELLIS_API_KEY,
            },
          }
        );
        const batchAssetIds = Object.keys(res.data.data);
        allAssetIds.push(...batchAssetIds);
        console.log(`Batch ${i / batchSize + 1}: Upload successful`);
      } catch (error) {
        console.error(`Failed to upload batch ${i / batchSize + 1}:`, error);
        response
          .status(500)
          .send(`Failed to upload batch ${i / batchSize + 1}`);
        return;
      }
    }

    const requestId = Date.now().toString();
    response.send({ message: "All batches uploaded successfully.", requestId });
  }

  // tranform

  async initiateTransformation(request: Request, response: Response) {
    const { projectName } = request.body;

    const headers = {
      Authorization: process.env.TRELLIS_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    try {
      const initiateResponse = await axios.post(
        "https://api.usetrellis.co/v1/transform/initiate",
        {
          proj_name: projectName,
          transform_params: transformationParams,
        },
        { headers }
      );

      response.json(initiateResponse.data);
    } catch (error) {
      console.error("Error initiating transformation:", error);
      response.status(500).send("Failed to initiate transformation");
    }
  }

  async fetchAndSaveTransformationResults(
    request: Request,
    response: Response
  ) {
    const transformId = request.query.transformationId as string;

    if (!transformId) {
      response.status(400).send("No transformation ID available.");
      return;
    }

    const transformResultsUrl = `https://api.usetrellis.co/v1/transform/${transformId}/results`;
    const headers = {
      Accept: "application/json",
      Authorization: process.env.TRELLIS_API_KEY,
    };

    try {
      const resultsResponse = await axios.get(transformResultsUrl, { headers });
      const results: Record<string, EmailTransformationResult[]> =
        resultsResponse.data.data;

      // Log the results
      console.log("Transformation Results:", results);

      for (const [assetId, resultArray] of Object.entries(results)) {
        for (const result of resultArray) {
          const existingEmail = await this.emailExtractionRepository.findOne({
            where: { ext_file_id: result.ext_file_id },
          });

          if (existingEmail) {
            // Prepare the update data, only including new fields from the API
            const updateData = {
              asset_id: assetId,
              result_id: result.result_id,
              email_from: result.email_from,
              email_to: result.email_to,
              people_mentioned: result.people_mentioned,
              compliance_risk: result.compliance_risk === "Yes",
              one_line_summary: result.one_line_summary,
              genre: result.genre,
              primary_topics: result.primary_topics,
              emotional_tone: result.emotional_tone,
              date: result.date,
            };

            console.log("Before update:", existingEmail);
            console.log("Update data:", updateData);

            // Update the existing record
            const updateResult = await this.emailExtractionRepository.update(
              existingEmail.id,
              updateData
            );

            console.log("After update:", updateResult);

            // Fetch the updated record to confirm changes
            const updatedEmail = await this.emailExtractionRepository.findOne({
              where: { id: existingEmail.id },
            });
            console.log("Updated email:", updatedEmail);
          } else {
            console.log(
              "No existing email found for ext_file_id:",
              result.ext_file_id
            );
          }
        }
      }

      response.send({
        message: "Transformation results fetched and saved successfully.",
      });
    } catch (error) {
      console.error("Failed to fetch transformation results:", error);
      response.status(500).send("Failed to fetch transformation results");
    }
  }

  async search(request: Request, response: Response) {
    const { query, filters, limit = 10 } = request.body;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    try {
      const queryEmbedding = await openai.embeddings.create({
        model: "text-embedding-3-large",
        dimensions: 256,
        input: query,
        encoding_format: "float",
      });

      const vector = queryEmbedding.data[0].embedding;

      // Create query builder
      let queryBuilder = this.emailExtractionRepository
        .createQueryBuilder("email")
        .select("email.*")
        .addSelect(`email.embedding <-> :embedding AS similarity_score`)
        .orderBy(`email.embedding <-> :embedding`, "ASC")
        .setParameter("embedding", pgvector.toSql(vector))
        .limit(limit);

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          queryBuilder = queryBuilder.andWhere(`email.${key} = :${key}`, {
            [key]: value,
          });
        });
      }

      const results = await queryBuilder.getRawMany();

      const formattedResults = results.map((result) => ({
        ...result,
        similarity_score:
          result.similarity_score !== null
            ? parseFloat(result.similarity_score)
            : null,
        vector_search_performed: result.similarity_score !== null,
      }));

      console.log("Vector search results:", formattedResults);

      response.json({
        message: "Search completed successfully",
        vector_search_performed: formattedResults.some(
          (result) => result.vector_search_performed
        ),
        results: formattedResults,
      });
    } catch (error) {
      console.error("Error searching emails:", error);
      response.status(500).send("Error searching emails");
    }
  }

  async checkEmbeddingColumnType(request: Request, response: Response) {
    try {
      const result = await this.emailExtractionRepository.query(
        "SELECT data_type FROM information_schema.columns WHERE table_name = 'email_extraction' AND column_name = 'embedding'"
      );
      response.json(result);
    } catch (error) {
      console.error("Error checking embedding column type:", error);
      response.status(500).send("Error checking embedding column type");
    }
  }

  // get and save emails to db

  async save(request: Request, response: Response, next: NextFunction) {
    console.log("request.body in save", request.body);

    if (!request.body || Object.keys(request.body).length === 0) {
      return response
        .status(400)
        .send("No data provided or empty request body");
    }

    // Check for required fields
    const requiredFields = ["ext_file_id", "full_email", "email_from"]; // Add all required fields
    for (const field of requiredFields) {
      if (!request.body[field]) {
        return response.status(400).send(`Missing required field: ${field}`);
      }
    }

    try {
      const emailExtraction = this.emailExtractionRepository.create(
        request.body
      );
      const savedEmail = await this.emailExtractionRepository.save(
        emailExtraction
      );
      return response.status(201).json(savedEmail);
    } catch (error) {
      console.error("Error saving email:", error);
      if (error instanceof QueryFailedError) {
        // This is a database error
        return response
          .status(400)
          .send("Invalid data provided: " + error.message);
      }
      return response.status(500).send("Error saving email");
    }
  }

  async all(request: Request, response: Response, next: NextFunction) {
    try {
      const allEmails = await AppDataSource.getRepository(
        EmailExtraction
      ).find();

      // console.log("allEmails", allEmails);

      const cleanEmails = allEmails.map((email) => ({
        id: email.id,
        asset_id: email.asset_id,
        ext_file_id: email.ext_file_id,
        ext_file_name: email.ext_file_name,
        embedding: email.embedding,

        // extraction data
        email_from: email.email_from,
        result_id: email.result_id,
        full_email: email.full_email,
        email_to: email.email_to,
        people_mentioned: email.people_mentioned,
        compliance_risk: email.compliance_risk,
        one_line_summary: email.one_line_summary,
        genre: email.genre,
        primary_topics: email.primary_topics,
        emotional_tone: email.emotional_tone,
        date: email.date,
      }));
      response.json(cleanEmails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      response.status(500).send("Error fetching emails");
    }
  }

  async seed(request: Request, response: Response) {
    const seedData = [
      {
        id: 4,
        asset_id: "asset_2iAyXxp3GldiTgc86ahmCkiG3lv",
        ext_file_id: "3140",
        ext_file_name: "3140.txt",
        embedding:
          "[0.01736869,-0.057406,-0.011979434,0.07169795,-0.0026971095,0.048513234,0.060224693,0.09853506,-0.049069032,0.21930204,0.000019287776,-0.020058356,0.0048979707,0.010589939,0.03146214,0.07042756,-0.113700405,0.035710026,-0.11917899,0.008783595,-0.015999045,0.1448251,-0.06907776,0.11909959,-0.039124213,-0.021676125,-0.039640315,-0.0042007416,-0.00427766,-0.07273015,0.038588267,0.061733287,-0.04073206,-0.04108936,0.07642224,-0.064869575,-0.011314461,0.15379727,-0.09591487,0.019482708,0.03205764,-0.016217394,0.06332128,0.038727216,0.04648854,-0.09186548,0.056215007,-0.10734843,-0.018003888,0.103457846,0.064869575,-0.0024849633,-0.08471951,0.044622645,-0.067410365,0.08972169,0.054031514,-0.030231446,0.039283015,-0.011860334,-0.02020723,0.0060691168,-0.024474965,-0.012981855,0.024852114,0.03769502,-0.07225375,0.043233152,0.053872716,0.06431378,-0.105204634,-0.020723328,0.10377544,0.060502592,0.00031248134,0.053475715,0.15872005,-0.059907094,-0.0011885146,-0.022926671,-0.07340505,-0.06999086,0.053277217,0.103378445,-0.055778306,0.006610027,-0.16769221,-0.22867121,-0.024991063,0.08305211,-0.014023976,0.0038211117,-0.0011897553,0.018103138,0.10504584,-0.034419782,0.030826943,-0.048116233,0.004500972,-0.0574457,0.0866251,-0.035729878,-0.10552224,-0.09631187,-0.004071717,-0.02888165,-0.050855525,0.0069425134,0.07876453,0.06538568,0.033109687,-0.04311405,-0.04640914,0.023621418,-0.010222714,-0.06320218,-0.044106547,-0.08194052,0.036762074,-0.08535471,-0.09321528,-0.027075306,-0.036543723,-0.03485648,-0.0031412516,0.066219375,0.023800068,0.012177933,0.0038732179,-0.07034816,-0.079240926,-0.06701337,-0.06891896,0.02624161,-0.012703956,0.034201432,0.0087637445,-0.02588431,0.021894474,0.00074685365,-0.13728213,-0.03457858,-0.023522168,-0.01025249,0.024157366,-0.06721187,0.03815157,0.074993044,-0.050021827,0.02594386,-0.062249385,-0.03981896,0.027015757,0.042121556,0.10226685,-0.036960572,0.04958513,0.12934215,-0.07507244,-0.10623683,-0.06439318,-0.031938538,-0.052840516,-0.009056531,0.050537925,-0.106078036,0.07642224,-0.03711937,0.005528206,0.07447694,0.03815157,-0.035253476,0.04573424,-0.0861487,0.0025358289,0.041962754,-0.0089423945,-0.024693314,-0.03715907,-0.109254025,-0.028067803,0.08868949,0.058199998,-0.037039973,-0.014162926,-0.07650164,0.06681487,-0.0070318384,0.07459604,-0.07820873,0.00649589,0.09543847,0.06506807,-0.001726944,0.14252251,0.019959105,0.03251419,0.03465798,0.034320533,-0.09956726,-0.011264836,0.012118383,0.026499659,0.107904226,0.043828648,0.035054978,-0.06435348,0.015562346,0.021676125,-0.012803206,-0.105363436,-0.018381037,0.09194488,-0.10441064,-0.06538568,0.019363608,-0.06340068,0.039203614,0.02342292,0.04394775,0.09527967,0.0051212823,0.041446656,0.012515382,0.01167176,-0.05474611,0.04081146,0.05244352,-0.015006548,0.061931785,-0.0288618,0.04069236,-0.00077662856,0.05180832,-0.059867393,-0.06895866,-0.021259276,0.013279604,0.09797926,0.04946603,0.06796616,0.0104906885,0.012713881,-0.06824406,0.044702046,0.04374925,-0.039799113,-0.03416173,-0.08329031,0.032593586,0.038886014,0.0013063736,0.036523875,-0.0152447475,0.10107585,0.07213465]",
        email_from: "matthew.lenhart@enron.com",
        result_id: "result_2iAyaqmkrs0V4fCoRvmugNzPJJP",
        full_email:
          'Message-ID: <26615524.1075863713396.JavaMail.evans@thyme>\r\nDate: Mon, 11 Sep 2000 06:23:00 -0700 (PDT)\r\nFrom: matthew.lenhart@enron.com\r\nTo: mmmarcantel@equiva.com\r\nSubject: Re: FW: qwerty\r\nMime-Version: 1.0\r\nContent-Type: text/plain; charset=us-ascii\r\nContent-Transfer-Encoding: 7bit\r\nX-From: Matthew Lenhart\r\nX-To: "Marcantel MM (Mitch)" <MMMarcantel@equiva.com> @ ENRON\r\nX-cc: \r\nX-bcc: \r\nX-Folder: \\Matthew_Lenhart_Jun2001\\Notes Folders\\All documents\r\nX-Origin: Lenhart-M\r\nX-FileName: mlenhar.nsf\r\n\r\ni need your ssn# for this form',
        email_to: ["mmmarcantel@equiva.com"],
        people_mentioned: [],
        compliance_risk: true,
        one_line_summary: "Request for SSN for a form.",
        genre: "company_business",
        primary_topics: "internal_operations",
        emotional_tone: "neutral",
        date: "09/11/2000",
      },
      {
        id: 3,
        asset_id: "asset_2iAyXxnuXRQyMXRBmAlr9HYsoUk",
        ext_file_id: "3139",
        ext_file_name: "3139.txt",
        embedding:
          "[-0.0074778395,-0.024163052,-0.018566018,0.06736611,-0.044655256,0.065591194,0.04804373,0.07878204,-0.06474407,0.18265493,0.027531357,0.013745509,-0.047882378,0.0015908688,0.02906424,0.00015820446,-0.083743736,0.042678647,-0.09979865,-0.007820721,-0.039532207,0.13384476,-0.03146441,0.09261831,0.01612551,-0.012968984,-0.06381628,-0.013957289,0.053650852,-0.004417119,-0.044372886,0.10229967,0.010740255,0.027531357,0.014965764,0.028176783,-0.032130003,0.050262377,0.007790467,-0.018757628,-0.017023053,-0.06409865,0.041165937,0.03505458,-0.019453475,-0.14764069,0.039955765,-0.100766785,-0.008521611,0.050423734,0.001357659,-0.107705094,-0.08390509,0.046833564,-0.055909835,-0.003375869,-0.0075988565,0.022529325,0.023275595,-0.00705428,-0.051230513,-0.007255975,-0.03545797,0.0430417,0.0049667377,0.14804408,-0.05651492,0.08172679,0.043243393,0.023658816,-0.022549493,-0.08104102,-0.010619238,0.08471187,0.025635425,-0.009681357,0.10092814,-0.065470174,-0.05377187,-0.0478017,-0.024505934,-0.036647968,0.014955679,0.009313263,-0.07051255,-0.03779763,-0.18620476,-0.23412748,-0.032775424,0.1381207,0.013473221,-0.011597458,0.036063053,-0.009580509,0.07882238,-0.034106612,0.06357424,-0.0461478,-0.023396611,-0.08221085,0.10028272,-0.09753967,-0.0023850426,0.011990763,0.053489495,0.017668476,-0.06696272,-0.015006103,0.106656276,0.12843934,0.045946106,0.06498611,-0.007442543,0.04897153,-0.011103306,-0.017497035,-0.06700306,-0.009792289,0.031807292,-0.06341289,-0.069100685,0.046389833,0.005213814,-0.06764848,0.06365492,0.06087153,0.030919833,0.02868102,0.088342376,-0.00796695,-0.091085434,-0.023275595,-0.010861272,-0.026966613,-0.04068187,0.02821712,0.017365934,0.0037716953,-0.008143432,-0.020472035,-0.081283055,-0.05578882,-0.0061012716,-0.04772102,-0.010770509,-0.106656276,0.0054911445,0.08785831,-0.11294916,-0.0056272885,-0.05094814,-0.10956068,0.048689157,0.086244754,0.042678647,0.000112665526,0.065187804,0.029911358,-0.075393565,-0.041952547,-0.09939526,-0.02190407,-0.021621697,0.03422763,0.05611153,-0.05453831,-0.017133985,-0.028378477,0.0061214413,0.078943394,-0.0059651276,-0.045421697,0.048406783,-0.0120916115,-0.028338138,0.017043222,-0.045623392,-0.017799577,-0.029548308,-0.11690238,0.0018719811,0.041670173,0.06914102,-0.047640342,-0.013967374,-0.036123563,-0.054175258,-0.010720085,0.042840004,-0.13763662,0.025292544,0.053812206,0.067124076,0.037595935,0.12045221,0.028136443,0.052360006,0.061758988,0.06736611,-0.1406217,-0.050746445,-0.043485425,0.015117035,0.112787805,0.001918623,0.053892884,-0.08269492,0.017436527,0.06575255,-0.048850514,-0.14054103,-0.07140001,0.07503051,-0.14158984,-0.0620817,0.1010895,-0.064138986,0.006035721,0.07886272,-0.02938695,0.13247323,-0.059419326,0.08152509,0.028196951,-0.027248986,0.06288848,0.023941189,0.017305424,0.019836696,0.04263831,-0.031182036,0.121823736,0.085195936,0.021783052,-0.024445426,-0.11795119,-0.007815679,0.040823054,0.13344136,0.039068308,-0.007412289,0.09027865,0.024828646,-0.0125756785,-0.025171528,-0.010992373,0.021783052,-0.015086781,-0.03824136,-0.007674492,0.013765679,-0.03350153,0.03937085,0.026361527,0.103913225,0.104558654]",
        email_from: "matthew.lenhart@enron.com",
        result_id: "result_2iAyawXrfWmP0ILYyglC2seJ7ur",
        full_email:
          'Message-ID: <29305561.1075863713322.JavaMail.evans@thyme>\r\nDate: Tue, 5 Sep 2000 08:20:00 -0700 (PDT)\r\nFrom: matthew.lenhart@enron.com\r\nTo: mmmarcantel@equiva.com\r\nSubject: Re: FW:\r\nMime-Version: 1.0\r\nContent-Type: text/plain; charset=us-ascii\r\nContent-Transfer-Encoding: 7bit\r\nX-From: Matthew Lenhart\r\nX-To: "Marcantel MM (Mitch)" <MMMarcantel@equiva.com> @ ENRON\r\nX-cc: \r\nX-bcc: \r\nX-Folder: \\Matthew_Lenhart_Jun2001\\Notes Folders\\All documents\r\nX-Origin: Lenhart-M\r\nX-FileName: mlenhar.nsf\r\n\r\ni called her again and left a message.  i might need to go through someone \nelse.',
        email_to: ["mmmarcantel@equiva.com"],
        people_mentioned: [],
        compliance_risk: false,
        one_line_summary:
          "Matthew Lenhart mentions he might need to contact someone else after leaving a message.",
        genre: "company_business",
        primary_topics: "internal_operations",
        emotional_tone: "neutral",
        date: "09/05/2000",
      },
      {
        id: 1,
        asset_id: "asset_2iAyXtyZeGExcs41usb2MAWSBiw",
        ext_file_id: "3076",
        ext_file_name: "3076.txt",
        embedding:
          "[0.017920354,-0.058837004,-0.00903497,0.070365064,-0.0025728724,0.046551038,0.06370352,0.10012263,-0.05046021,0.21093564,-0.004407789,-0.018857758,0.0007928037,0.01146823,0.03386618,0.07315733,-0.115280636,0.035022974,-0.11831224,0.008526379,-0.013901489,0.14088969,-0.07088363,0.11767401,-0.04168452,-0.022038946,-0.043718886,-0.0073645976,-0.0008657267,-0.07319722,0.03978977,0.062068053,-0.035740986,-0.03314817,0.07742551,-0.06625645,-0.010107,0.15030362,-0.09844727,0.016992925,0.035900544,-0.013871571,0.065458655,0.038972035,0.044038,-0.088076,0.054848053,-0.10451047,-0.017631156,0.1055476,0.06577778,-0.001988242,-0.0839275,0.04786739,-0.06645589,0.09461788,0.060392693,-0.03181187,0.041844077,-0.01222613,-0.022697123,0.008022774,-0.027982479,-0.012076545,0.019954719,0.038214136,-0.06912849,0.040687285,0.054688495,0.065059766,-0.10833986,-0.024970824,0.109137654,0.06055225,0.0008283303,0.058876894,0.15556903,-0.05831844,-0.0010446061,-0.026207397,-0.074274234,-0.06733347,0.05748076,0.10275534,-0.0550475,0.005534667,-0.16450427,-0.22992304,-0.0235348,0.0850444,-0.0105607435,0.003283404,-0.001894751,0.02197911,0.10738251,-0.03268944,0.030894414,-0.047667947,0.005120814,-0.053731147,0.087198436,-0.030914357,-0.10323401,-0.09374031,-0.006915841,-0.026666127,-0.050699547,0.010500909,0.077585064,0.062666394,0.03428502,-0.042123307,-0.047987062,0.020662758,-0.008830537,-0.062307388,-0.04407789,-0.08456573,0.03516259,-0.082651034,-0.09286274,-0.02566889,-0.03655872,-0.034005795,0.0012315881,0.065059766,0.026167508,0.014659389,0.003176201,-0.06928805,-0.081454344,-0.071003295,-0.065059766,0.030655077,-0.011189003,0.03314817,0.007903106,-0.029817397,0.022457784,-0.0015444714,-0.13777831,-0.03625955,-0.021819552,-0.011657705,0.022158613,-0.07188087,0.04192386,0.07144208,-0.04970231,0.025110437,-0.058797114,-0.040527724,0.032849,0.04415767,0.10498915,-0.038273968,0.04726905,0.13163532,-0.079938546,-0.105866715,-0.06864982,-0.027065022,-0.050619766,-0.006736338,0.048585404,-0.10115976,0.078223296,-0.034983087,0.009199514,0.07367589,0.038672864,-0.03727673,0.0425222,-0.08384772,0.0036075062,0.04232275,-0.0076188934,-0.021799609,-0.035800822,-0.10945677,-0.02600795,0.08863445,0.060991034,-0.038852368,-0.016274914,-0.076508045,0.06845037,-0.0042582033,0.07459335,-0.08141445,0.007155178,0.0990855,0.06474065,0.00055440166,0.14041102,0.017252207,0.030635132,0.031911597,0.035800822,-0.09828771,-0.009787885,0.01042113,0.030056734,0.10634539,0.045474023,0.032868944,-0.06142982,0.013343035,0.02058298,-0.014240549,-0.104271136,-0.015786268,0.09541567,-0.10379246,-0.064381644,0.019446129,-0.063863076,0.0425222,0.025369719,0.047588166,0.09996307,0.007693686,0.040308334,0.014360217,0.011986793,-0.05137767,0.043639105,0.050619766,-0.016982952,0.06565811,-0.025489386,0.039011925,0.0023248096,0.054010373,-0.06358385,-0.06809136,-0.024990767,0.011059362,0.09182561,0.046551038,0.06705424,0.016334748,0.010829997,-0.07235954,0.04722916,0.04260198,-0.03835375,-0.037496123,-0.08297015,0.033886123,0.038433526,-0.005270399,0.03386618,-0.017720908,0.10618583,0.07279833]",
        email_from: "matthew.lenhart@enron.com",
        result_id: "result_2iAyawS2d3l24QdCWq6DrNu4bni",
        full_email:
          'Message-ID: <16517238.1075863713588.JavaMail.evans@thyme>\r\nDate: Mon, 11 Sep 2000 06:23:00 -0700 (PDT)\r\nFrom: matthew.lenhart@enron.com\r\nTo: mmmarcantel@equiva.com\r\nSubject: Re: FW: qwerty\r\nMime-Version: 1.0\r\nContent-Type: text/plain; charset=us-ascii\r\nContent-Transfer-Encoding: 7bit\r\nX-From: Matthew Lenhart\r\nX-To: "Marcantel MM (Mitch)" <MMMarcantel@equiva.com> @ ENRON\r\nX-cc: \r\nX-bcc: \r\nX-Folder: \\Matthew_Lenhart_Jun2001\\Notes Folders\\Sent\r\nX-Origin: Lenhart-M\r\nX-FileName: mlenhar.nsf\r\n\r\ni need your ssn# for this form',
        email_to: ["mmmarcantel@equiva.com"],
        people_mentioned: [],
        compliance_risk: true,
        one_line_summary: "Request for SSN for a form.",
        genre: "company_business",
        primary_topics: "internal_operations",
        emotional_tone: "neutral",
        date: "09/11/2000",
      },
      {
        id: 2,
        asset_id: "asset_2iAyXtyu5AKEXLefFeTIxt2kCN6",
        ext_file_id: "3077",
        ext_file_name: "3077.txt",
        embedding:
          "[0.01806122,-0.12833713,-0.05601188,0.049140986,-0.0033274635,0.020180753,-0.014073287,0.08558487,0.013932655,0.14272182,0.061436277,0.0015004977,-0.00638873,0.060873747,0.019055692,0.082370415,-0.0769862,0.026539346,-0.097237274,0.036443885,-0.029472537,0.061315734,-0.09932667,0.06280242,0.010718199,0.04319424,0.064490005,-0.05356086,0.02380706,-0.049221344,-0.02035152,0.05464574,0.06653922,0.023204349,-0.050145503,0.00071383506,0.03194365,0.09948739,0.01483672,-0.046810504,-0.109532565,-0.021818114,-0.025796004,0.061797902,0.02159712,-0.01920637,-0.030477054,-0.031702563,-0.020251067,0.052556343,0.01978899,-0.052837607,-0.024952209,-0.053962667,-0.015559972,0.019718673,0.04239063,0.08630812,0.016212909,-0.010366619,0.064851634,-0.04540418,0.013480621,0.013741796,0.06320423,0.11973846,-0.05227508,0.024028054,0.07566024,0.018392712,-0.005253625,-0.07738801,0.0005980017,0.10607702,-0.014223965,0.05629315,0.063806936,-0.02211947,0.015851282,-0.0071722534,-0.00471872,0.05356086,0.05709676,0.06629814,-0.030517235,0.030919041,-0.10262148,-0.27130002,-0.026418803,0.05291797,0.02842784,0.102460764,0.05106966,-0.03363124,0.13187303,-0.034515213,-0.0054796417,-0.01745851,-0.01970863,-0.15533856,0.047413215,-0.000103983235,-0.040060148,-0.042229906,0.060351398,0.060150493,-0.12865858,-0.050748214,0.025775913,0.12166713,0.009492688,0.03473621,-0.004399786,-0.06979386,-0.09064764,-0.05757893,-0.08566523,-0.048417732,0.00963332,-0.03304862,-0.092817396,-0.071883254,0.10583594,-0.057297666,0.008131567,0.04488183,0.019397229,0.058462907,0.07778982,-0.03312898,-0.1246405,-0.08116499,0.0038473012,-0.0045705535,-0.06521326,-0.02153685,0.056132425,0.0165444,0.067101754,-0.00728275,-0.025414286,-0.07505753,0.019979848,-0.025253564,0.057458386,-0.073731564,0.040240962,0.079035416,-0.095710404,0.053962667,-0.032064192,-0.0098191565,0.014434913,0.09820161,0.09924631,-0.09924631,-0.009005497,0.017759865,-0.12536375,-0.074615546,0.044480026,0.015499702,0.02095423,0.13428387,0.08220969,-0.052516162,-0.030919041,-0.057538748,-0.05926652,0.07674512,-0.020773416,-0.03847301,0.04315406,-0.09812125,-0.11073799,-0.00652434,-0.0041335886,0.015429385,-0.07726747,-0.15927626,0.07288777,0.05713694,0.024389679,-0.0037995866,-0.03200392,-0.08068283,0.02665989,-0.08245078,-0.012707143,-0.06931169,0.072365426,0.022240013,0.1044698,0.08245078,0.09900522,0.010959283,0.006730266,0.059186157,0.0035283668,0.021998929,0.03363124,0.009522824,-0.010165715,0.08341511,-0.031220397,-0.02967344,-0.09996956,-0.014244054,0.042511173,-0.050225865,-0.09932667,-0.14770421,0.032707084,-0.005072812,-0.11105943,0.05990941,-0.012847776,0.024530312,0.12986399,-0.04150665,0.019638313,-0.006012036,0.012717188,0.02856847,0.04612743,0.0008237042,0.010055218,0.012476104,-0.0022036599,-0.009412327,-0.04291298,0.09900522,0.018091356,0.041426294,-0.041667376,-0.06738302,-0.006152668,-0.0005738305,0.12271183,0.043314785,0.042671893,0.0191461,-0.046207793,-0.017528826,0.08285259,0.016554445,0.0053741676,0.1637765,-0.040803492,0.07819162,0.036504157,-0.029733712,-0.0059417197,0.05633333,0.08028102,0.06320423]",
        email_from: "matthew.lenhart@enron.com",
        result_id: "result_2iAyb5uSgyFcAvc45J57iFk0Wem",
        full_email:
          "Message-ID: <9407461.1075863713610.JavaMail.evans@thyme>\r\nDate: Thu, 12 Oct 2000 05:06:00 -0700 (PDT)\r\nFrom: matthew.lenhart@enron.com\r\nTo: phillip.allen@enron.com\r\nSubject: \r\nMime-Version: 1.0\r\nContent-Type: text/plain; charset=us-ascii\r\nContent-Transfer-Encoding: 7bit\r\nX-From: Matthew Lenhart\r\nX-To: Phillip K Allen\r\nX-cc: \r\nX-bcc: \r\nX-Folder: \\Matthew_Lenhart_Jun2001\\Notes Folders\\Sent\r\nX-Origin: Lenhart-M\r\nX-FileName: mlenhar.nsf\r\n\r\n---------------------- Forwarded by Matthew Lenhart/HOU/ECT on 10/12/2000 \n12:06 AM ---------------------------\n\n\nBen.F.Jacoby@enron.com@enron.com on 10/12/2000 07:29:24 AM\nSent by: Shelby.Malkemes@enron.com\nTo: matthew.lenhart@enron.com, phillip.allen@enron.com\ncc:  \n\nSubject: \n\n\nDear Phillip Allen and Matthew Lenhart:\n\nAs you know, I am Matthew Lenhart's PRC representative. As such, I would\nlike to meet with each of you (separately or together) to discuss the year\nend PRC process, and Matthew Lenhart's activities during the second half of\nthe year. It is extremely important that we meet prior to year end so that\nI can make sure I can adequately represent  your interests in the PRC.\nTherefore, at your convenience, please contact my assistant, Shelby\nMalkemes (x3-9842) to set up a time for us to get together. My guess is\nthat 45 minutes is probably sufficient, and we can arrange a follow up if\nneeded.\n\nIf you need to contact me directly before our meeting, I can be reached at\nx3-6173.\n\nRegards,\n\nBen\n",
        email_to: ["phillip.allen@enron.com"],
        people_mentioned: [
          "Matthew Lenhart",
          "Phillip Allen",
          "Ben Jacoby",
          "Shelby Malkemes",
        ],
        compliance_risk: false,
        one_line_summary:
          "Ben Jacoby requests a meeting to discuss the year-end PRC process and Matthew Lenhart's activities.",
        genre: "company_business",
        primary_topics: "internal_operations",
        emotional_tone: "neutral",
        date: "10/12/2000",
      },
    ];

    for (const data of seedData) {
      const emailExtraction = this.emailExtractionRepository.create({
        ...data,
        embedding: pgvector.toSql(data.embedding),
      });
      await this.emailExtractionRepository.save(emailExtraction);
    }

    response.send({ message: "Seed data inserted successfully." });
  }
}
